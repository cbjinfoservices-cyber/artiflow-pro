import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EscaladeJournalItem } from "@/hooks/useArtisanData";
import { ecrireBrut, lireBrut } from "@/lib/stockageLocal";
import { afficherNotification, demanderPermissionNotifications, lirePermissionNotifications, notificationsDisponibles, type NotifPermission } from "@/lib/notificationsSysteme";

// Clés de préférences partagées entre la page Relances et le tableau de bord,
// pour que le réglage de surveillance soit identique partout.
const SURVEILLANCE_KEY = "artiflow.relances.surveillanceFreq";
const ALERTE_BANDEAU_KEY = "artiflow.relances.alerteBandeau";
const SEEN_ECHEc_KEY = "artiflow.relances.dernierEchecVu";
const NOTIF_NAV_KEY = "artiflow.relances.notifNavigateur";
const SEUIL_ALERTE_KEY = "artiflow.relances.seuilAlerteEchec";

export const SURVEILLANCE_OPTIONS = [
  { value: 0, label: "Désactivée" },
  { value: 1, label: "1 min" },
  { value: 5, label: "5 min" },
  { value: 15, label: "15 min" },
] as const;
export const SURVEILLANCE_DEFAUT = 1;

/** Seuils d'échecs consécutifs déclenchant l'email d'alerte à l'artisan. */
export const SEUIL_ALERTE_OPTIONS = [2, 3, 5] as const;
export const SEUIL_ALERTE_DEFAUT = 3;

/** Permission navigateur pour les notifications (union locale, indépendante du DOM lib). */
export type { NotifPermission };

export interface EchecAlerte {
  echecs: number;
  passages: number;
}

export interface EchecsSurveillance {
  surveillanceFreq: number;
  alerteBandeau: boolean;
  echecAlerte: EchecAlerte | null;
  changeSurveillance: (value: number) => void;
  toggleAlerteBandeau: () => void;
  dismissAlerte: () => void;
  echecsRecents: number;
  passagesEchecRecents: number;
  echecsRecentsIds: number[];
  /** Notification navigateur activée ou non (en plus du bandeau in-app). */
  notifNav: boolean;
  /** Permission navigateur courante (granted / denied / default). */
  notifPermission: NotifPermission;
  /** Bascule la notification navigateur (demande la permission au premier clic). */
  toggleNotifNav: () => void;
  /** Seuil d'échecs consécutifs déclenchant l'email d'alerte (2 / 3 / 5). */
  seuilAlerte: number;
  /** Modifie le seuil d'alerte email. */
  changeSeuilAlerte: (value: number) => void;
}

/**
 * Centralise la surveillance des échecs d'envoi côté client :
 * - rafraîchissement silencieux périodique (fréquence réglable, 0 = coupée) ;
 * - détection d'un nouveau passage en échec → bandeau d'alerte in-app + notification navigateur ;
 * - calcul des échecs des 7 derniers jours (compteur + ids à réessayer).
 * Utilisé à la fois par la page Relances et par le tableau de bord.
 */
export function useEchecsSurveillance(
  journal: EscaladeJournalItem[],
  refresh: () => void,
  userId: string | null | undefined,
): EchecsSurveillance {
  const [surveillanceFreq, setSurveillanceFreq] = useState<number>(SURVEILLANCE_DEFAUT);
  const [alerteBandeau, setAlerteBandeau] = useState(true);
  const [echecAlerte, setEchecAlerte] = useState<EchecAlerte | null>(null);
  const [notifNav, setNotifNav] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotifPermission>(
    lirePermissionNotifications(),
  );
  const [seuilAlerte, setSeuilAlerte] = useState<number>(SEUIL_ALERTE_DEFAUT);
  // Dernier id de passage d'escalade déjà notifié (persisté pour survivre aux rechargements).
  const seenEchecIdRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = Number(lireBrut(SURVEILLANCE_KEY));
    if (SURVEILLANCE_OPTIONS.some((o) => o.value === saved)) setSurveillanceFreq(saved);
    const savedBandeau = lireBrut(ALERTE_BANDEAU_KEY);
    if (savedBandeau !== null) setAlerteBandeau(savedBandeau === "true");
    const savedNotif = lireBrut(NOTIF_NAV_KEY);
    if (savedNotif !== null) setNotifNav(savedNotif === "true");
    const savedSeuil = Number(lireBrut(SEUIL_ALERTE_KEY));
    if (SEUIL_ALERTE_OPTIONS.includes(savedSeuil as (typeof SEUIL_ALERTE_OPTIONS)[number])) setSeuilAlerte(savedSeuil);
  }, []);

  // Rafraîchissement silencieux périodique (sans recharger toute la page).
  useEffect(() => {
    if (!userId || surveillanceFreq <= 0) return;
    const id = setInterval(() => {
      refresh();
    }, surveillanceFreq * 60000);
    return () => clearInterval(id);
  }, [userId, refresh, surveillanceFreq]);

  // Détecte les passages enregistrés depuis la dernière visite qui comportent un échec.
  useEffect(() => {
    if (surveillanceFreq <= 0) return;
    if (!alerteBandeau && !notifNav) return;
    if (journal.length === 0) return;
    const maxId = journal.reduce((max, run) => (run.id > max ? run.id : max), 0);
    if (seenEchecIdRef.current === null) {
      const stored = Number(lireBrut(SEEN_ECHEc_KEY));
      const baseline = Number.isFinite(stored) && stored > 0 ? stored : maxId;
      seenEchecIdRef.current = baseline;
      ecrireBrut(SEEN_ECHEc_KEY, String(baseline));
      return;
    }
    const seen = seenEchecIdRef.current;
    if (maxId <= seen) return;
    const nouveaux = journal.filter((run) => run.id > seen && run.echoue > 0);
    const nbNouveaux = nouveaux.reduce((sum, run) => sum + run.echoue, 0);
    seenEchecIdRef.current = maxId;
    ecrireBrut(SEEN_ECHEc_KEY, String(maxId));
    if (nbNouveaux > 0) {
      if (alerteBandeau) setEchecAlerte({ echecs: nbNouveaux, passages: nouveaux.length });
      if (notifNav && lirePermissionNotifications() === "granted") {
        afficherNotification("ArtiFlow-pro · Échec d'envoi détecté", {
          body: `${nbNouveaux} envoi${nbNouveaux > 1 ? "s" : ""} sur ${nouveaux.length} passage${
            nouveaux.length > 1 ? "s" : ""
          } viennent d'échouer. Vérifiez vos identifiants d'envoi.`,
          tag: "artiflow-echec-envoi",
        });
      }
    }
  }, [journal, surveillanceFreq, alerteBandeau, notifNav]);

  // Règle la fréquence de surveillance (0 = coupée). Couper la surveillance arrête
  // aussi la détection automatique, donc le bandeau d'alerte.
  const changeSurveillance = useCallback((value: number) => {
    setSurveillanceFreq(value);
    ecrireBrut(SURVEILLANCE_KEY, String(value));
    if (value === 0) setEchecAlerte(null);
  }, []);

  // Active ou coupe uniquement le bandeau d'alerte in-app (la surveillance continue).
  const toggleAlerteBandeau = useCallback(() => {
    setAlerteBandeau((prev) => {
      const next = !prev;
      ecrireBrut(ALERTE_BANDEAU_KEY, String(next));
      if (!next) setEchecAlerte(null);
      return next;
    });
  }, []);

  const dismissAlerte = useCallback(() => setEchecAlerte(null), []);

  // Règle le seuil d'échecs consécutifs déclenchant l'email d'alerte à l'artisan.
  const changeSeuilAlerte = useCallback((value: number) => {
    setSeuilAlerte(value);
    ecrireBrut(SEUIL_ALERTE_KEY, String(value));
  }, []);

  // Bascule la notification navigateur. Au premier clic, demande la permission au navigateur.
  const toggleNotifNav = useCallback(async () => {
    if (!notificationsDisponibles()) return;
    if (notifNav) {
      setNotifNav(false);
      ecrireBrut(NOTIF_NAV_KEY, "false");
      return;
    }
    const perm = await demanderPermissionNotifications();
    setNotifPermission(perm);
    const enabled = perm === "granted";
    setNotifNav(enabled);
    ecrireBrut(NOTIF_NAV_KEY, String(enabled));
  }, [notifNav]);

  // Échecs des 7 derniers jours, tous passages confondus.
  const { echecsRecents, passagesEchecRecents, echecsRecentsIds } = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    let total = 0;
    let passages = 0;
    const ids = new Set<number>();
    journal.forEach((run) => {
      const t = Date.parse(run.run_at);
      if (Number.isNaN(t) || t < cutoff) return;
      if (run.echoue > 0) {
        total += run.echoue;
        passages += 1;
        run.relancesEchouees.forEach((id) => ids.add(id));
      }
    });
    return { echecsRecents: total, passagesEchecRecents: passages, echecsRecentsIds: Array.from(ids) };
  }, [journal]);

  return {
    surveillanceFreq,
    alerteBandeau,
    echecAlerte,
    changeSurveillance,
    toggleAlerteBandeau,
    dismissAlerte,
    echecsRecents,
    passagesEchecRecents,
    echecsRecentsIds,
    notifNav,
    notifPermission,
    toggleNotifNav,
    seuilAlerte,
    changeSeuilAlerte,
  };
}