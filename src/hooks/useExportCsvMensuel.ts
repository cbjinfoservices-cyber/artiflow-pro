import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { chargerHistoriqueExportCsvMensuel, EXPORT_CSV_HEURE_DEFAUT, EXPORT_CSV_JOUR_DEFAUT, updateExportCsvMensuel, type ExportCsvMensuelHistoriqueItem } from "@/lib/exportCsvMensuel";
import { ecrireBrut, lireBrut } from "@/lib/stockageLocal";

// Clés de préférences locales de l'export CSV mensuel, pour retrouver ses réglages
// même avant le chargement du profil Backend.
const ACTIF_KEY = "artiflow.exportcsv.mensuel.actif";
const JOUR_KEY = "artiflow.exportcsv.mensuel.jour";
const HEURE_KEY = "artiflow.exportcsv.mensuel.heure";
const CC_KEY = "artiflow.exportcsv.mensuel.cc";

export { EXPORT_CSV_JOUR_DEFAUT, EXPORT_CSV_HEURE_DEFAUT };

export interface ExportCsvMensuel {
  /** Export CSV mensuel par email activé. */
  actif: boolean;
  /** Jour du mois (1-28) de l'envoi. */
  jour: number;
  /** Heure d'envoi (0-23, heure de Paris). */
  heure: number;
  /** Destinataires en copie (Cc), séparés par des virgules. */
  cc: string;
  /** Date et heure du dernier export mensuel réellement envoyé (ou null). */
  dernierEnvoi: string | null;
  /** Petit historique des derniers envois (du plus récent au plus ancien). */
  historique: ExportCsvMensuelHistoriqueItem[];
  /** Recharge l'historique des envois depuis le Backend. */
  refreshHistorique: () => Promise<void>;
  toggleActif: () => void;
  changeJour: (jour: number) => void;
  changeHeure: (heure: number) => void;
  changeCc: (cc: string) => void;
}

interface State {
  actif: boolean;
  jour: number;
  heure: number;
  cc: string;
}

function readLocalActif(): boolean {
  const raw = lireBrut(ACTIF_KEY);
  if (raw !== null) return raw === "true";
  return false;
}

function readLocalJour(): number {
  const n = Number(lireBrut(JOUR_KEY));
  if (Number.isFinite(n) && n >= 1 && n <= 28) return Math.round(n);
  return EXPORT_CSV_JOUR_DEFAUT;
}

function readLocalHeure(): number {
  const n = Number(lireBrut(HEURE_KEY));
  if (Number.isFinite(n) && n >= 0 && n <= 23) return Math.round(n);
  return EXPORT_CSV_HEURE_DEFAUT;
}

function readLocalCc(): string {
  return lireBrut(CC_KEY) ?? "";
}

/**
 * Centralise les réglages de l'export CSV mensuel par email du journal des réessais et du
 * journal d'escalade : interrupteur d'activation, jour du mois, heure d'envoi et liste de
 * destinataires en copie (Cc). Expose aussi la date du dernier envoi et un petit historique.
 * Les valeurs sont mémorisées dans le navigateur et synchronisées avec le profil Backend pour
 * que la tâche planifiée mensuelle utilise exactement les mêmes réglages.
 */
export function useExportCsvMensuel(): ExportCsvMensuel {
  const { user, profile } = useAuth();
  const [actif, setActif] = useState<boolean>(() => readLocalActif());
  const [jour, setJour] = useState<number>(() => readLocalJour());
  const [heure, setHeure] = useState<number>(() => readLocalHeure());
  const [cc, setCc] = useState<string>(() => readLocalCc());
  const [historique, setHistorique] = useState<ExportCsvMensuelHistoriqueItem[]>([]);

  const appliedProfileRef = useRef(false);

  // Applique les réglages enregistrés côté Backend dès que le profil est chargé.
  useEffect(() => {
    if (!profile || appliedProfileRef.current) return;
    appliedProfileRef.current = true;
    if (typeof profile.export_csv_mensuel_actif === "boolean") {
      setActif(profile.export_csv_mensuel_actif);
    }
    if (typeof profile.export_csv_mensuel_jour === "number" && profile.export_csv_mensuel_jour >= 1) {
      setJour(Math.min(28, profile.export_csv_mensuel_jour));
    }
    if (typeof profile.export_csv_mensuel_heure === "number") {
      setHeure(profile.export_csv_mensuel_heure);
    }
    if (typeof profile.export_csv_mensuel_cc === "string") {
      setCc(profile.export_csv_mensuel_cc);
    }
  }, [profile]);

  const persist = useCallback(
    (next: State) => {
      if (!user) return;
      updateExportCsvMensuel(user.id, next).catch(() => {
        /* l'app reste utilisable même si la synchro échoue */
      });
    },
    [user],
  );

  const snapshot: State = { actif, jour, heure, cc };

  const refreshHistorique = useCallback(async () => {
    if (!user?.id) {
      setHistorique([]);
      return;
    }
    try {
      setHistorique(await chargerHistoriqueExportCsvMensuel(user.id));
    } catch {
      /* l'historique est best effort */
    }
  }, [user?.id]);

  useEffect(() => {
    void refreshHistorique();
  }, [refreshHistorique]);

  const toggleActif = useCallback(() => {
    setActif((prev) => {
      const next = !prev;
      ecrireBrut(ACTIF_KEY, String(next));
      persist({ ...snapshot, actif: next });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist, actif, jour, heure, cc]);

  const changeJour = useCallback(
    (value: number) => {
      const safe = Math.min(28, Math.max(1, Math.round(Number.isFinite(value) ? value : EXPORT_CSV_JOUR_DEFAUT)));
      setJour(safe);
      ecrireBrut(JOUR_KEY, String(safe));
      persist({ ...snapshot, jour: safe });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persist, actif, jour, heure, cc],
  );

  const changeHeure = useCallback(
    (value: number) => {
      const safe = Math.min(23, Math.max(0, Math.round(Number.isFinite(value) ? value : EXPORT_CSV_HEURE_DEFAUT)));
      setHeure(safe);
      ecrireBrut(HEURE_KEY, String(safe));
      persist({ ...snapshot, heure: safe });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persist, actif, jour, heure, cc],
  );

  const changeCc = useCallback(
    (value: string) => {
      const safe = value;
      setCc(safe);
      ecrireBrut(CC_KEY, safe);
      persist({ ...snapshot, cc: safe });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persist, actif, jour, heure, cc],
  );

  const dernierEnvoi =
    typeof profile?.export_csv_mensuel_dernier_envoi === "string"
      ? profile.export_csv_mensuel_dernier_envoi
      : null;

  return {
    actif,
    jour,
    heure,
    cc,
    dernierEnvoi,
    historique,
    refreshHistorique,
    toggleActif,
    changeJour,
    changeHeure,
    changeCc,
  };
}