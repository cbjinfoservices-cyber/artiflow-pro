import { useCallback, useEffect, useState } from "react";
import { libelleDans, type ExecutionImminente } from "@/lib/envoisAutomatiques";
import { ajouterJournalImminentes } from "@/lib/journalImminentesMemoire";
import { ecrireBrut, lireBrut } from "@/lib/stockageLocal";
import { afficherNotification, demanderPermissionNotifications, lirePermissionNotifications, notificationsDisponibles, type NotifPermission } from "@/lib/notificationsSysteme";

/**
 * Notification navigateur (système) lorsqu'un traitement automatique devient imminent — c'est-à-dire
 * quand une automatisation ou un récap va s'exécuter dans la fenêtre d'alerte réglée (15 / 30 / 60 min).
 * Elle double le bandeau affiché dans le menu et fonctionne depuis n'importe quelle page de l'espace
 * (le hook est monté au niveau du layout). Chaque signalement est aussi consigné dans le journal local
 *
 * Comme pour les relances du jour, l'artisan active la cloche une première fois (permission demandée au
 * premier clic), et la préférence est mémorisée. Une alerte n'est émise qu'une seule fois par traitement
 * imminent : tant qu'un traitement reste dans la fenêtre, il n'est pas re-signalé ; s'il disparaît puis
 * revient lors d'un cycle ultérieur, il est à nouveau signalé.
 */

// Préférence « notifier le navigateur quand un traitement devient imminent ».
const CLE_PREF = "artiflow.imminents.notifNav";
// Identifiants des traitements déjà signalés (pour n'alerter qu'une fois chacun).
const CLE_ENVOYES = "artiflow.imminents.notifEnvoyes";


/** Lit la liste des identifiants déjà signalés (robuste à un stockage corrompu). */
function lireIdsEnvoyes(): string[] {
  try {
    const brut = lireBrut(CLE_ENVOYES);
    if (!brut) return [];
    const parsed = JSON.parse(brut);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Enregistre les identifiants déjà signalés. */
function ecrireIdsEnvoyes(ids: string[]): void {
  ecrireBrut(CLE_ENVOYES, JSON.stringify(ids));
}

export interface NotificationImminente {
  /** La notification navigateur est-elle activée par l'artisan ? */
  actif: boolean;
  /** État courant de la permission navigateur. */
  permission: NotifPermission;
  /** Active/désactive la notification (demande la permission au premier clic). */
  toggle: () => Promise<void>;
}

/**
 * Surveille les exécutions imminentes et envoie une notification navigateur à chaque nouveau
 * traitement qui entre dans la fenêtre « dans l'heure ». Expose l'état et la bascule de la préférence.
 */
export function useNotificationImminente(executions: ExecutionImminente[]): NotificationImminente {
  const [actif, setActif] = useState(() => lireBrut(CLE_PREF) === "true");
  const [permission, setPermission] = useState<NotifPermission>(() =>
    lirePermissionNotifications(),
  );

  // Émission des notifications : une seule fois par traitement imminent, en ignorant ceux déjà signalés.
  useEffect(() => {
    if (!actif) return;
    if (lirePermissionNotifications() !== "granted") return;

    const idsCourants = executions.map((e) => e.item.id);
    const envoyes = lireIdsEnvoyes();
    // On oublie les traitements sortis de la fenêtre : s'ils reviennent au cycle suivant, ils réalerteront.
    const restants = envoyes.filter((id) => idsCourants.includes(id));
    const nouveaux = executions.filter((e) => !restants.includes(e.item.id));

    if (nouveaux.length === 0) {
      if (restants.length !== envoyes.length) ecrireIdsEnvoyes(restants);
      return;
    }

    const lignes = nouveaux.map((e) => `${e.item.nom} — ${libelleDans(e.dansMs)}`);
    const corps =
      lignes.slice(0, 4).join("\n") +
      (lignes.length > 4 ? `\n+ ${lignes.length - 4} autre(s)` : "");
    afficherNotification("ArtiFlow-pro · Traitement imminent", {
      body: corps,
      tag: "artiflow-traitement-imminent",
    });
    ecrireIdsEnvoyes([...restants, ...nouveaux.map((e) => e.item.id)]);
    // Historise le signalement : le journal local permet de vérifier ce qui a déjà été notifié.
    const notifieLe = new Date().toISOString();
    ajouterJournalImminentes(
      nouveaux.map((e) => ({
        cle: `${e.item.id}-${Date.now()}`,
        id: e.item.id,
        nom: e.item.nom,
        categorie: e.item.categorie,
        icone: e.item.icone,
        notifieLe,
        dansMin: Math.max(0, Math.round(e.dansMs / 60000)),
      })),
    );
  }, [executions, actif]);

  // Bascule la préférence. Au premier clic, demande la permission au navigateur.
  const toggle = useCallback(async () => {
    if (!notificationsDisponibles()) return;
    if (actif) {
      setActif(false);
      ecrireBrut(CLE_PREF, "false");
      return;
    }
    const perm = await demanderPermissionNotifications();
    setPermission(perm);
    const enabled = perm === "granted";
    setActif(enabled);
    ecrireBrut(CLE_PREF, String(enabled));
  }, [actif]);

  return { actif, permission, toggle };
}