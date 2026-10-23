import { Capacitor } from "@capacitor/core";
import { LocalNotifications, type PermissionStatus } from "@capacitor/local-notifications";
import { ecrireBrut, lireBrut } from "@/lib/stockageLocal";

/**
 * Notifications système (relances du jour, traitements imminents, échecs d'envoi, taux en chute).
 *
 * Sur le web, on utilise l'API `Notification` du navigateur. Dans l'application mobile, cette API
 * n'existe pas (WebView Android / iOS) : on passe par les notifications locales natives de Capacitor,
 * qui s'affichent dans le centre de notifications du téléphone.
 */

/** Permission de notification (union locale, indépendante du DOM lib). */
export type NotifPermission = "granted" | "denied" | "default";

// Dernière permission lue auprès du système dans l'application mobile : l'API native est
// asynchrone, alors que les écrans lisent la permission à l'initialisation de leur état.
const CLE_PERMISSION_NATIVE = "artiflow.notifications.permissionNative";

function depuisEtatNatif(etat: PermissionStatus["display"]): NotifPermission {
  if (etat === "granted") return "granted";
  if (etat === "denied") return "denied";
  return "default";
}

/** Les notifications système sont-elles prises en charge sur cet appareil ? */
export function notificationsDisponibles(): boolean {
  return Capacitor.isNativePlatform() || typeof Notification !== "undefined";
}

/** Permission connue, lue de façon synchrone. */
export function lirePermissionNotifications(): NotifPermission {
  if (Capacitor.isNativePlatform()) {
    const memo = lireBrut(CLE_PERMISSION_NATIVE);
    return memo === "granted" || memo === "denied" ? memo : "default";
  }
  return typeof Notification !== "undefined" ? Notification.permission : "denied";
}

/**
 * Application mobile : relit la permission auprès du système (l'artisan a pu la changer dans les
 * réglages du téléphone). À appeler au démarrage et au retour au premier plan.
 */
export async function actualiserPermissionNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { display } = await LocalNotifications.checkPermissions();
  ecrireBrut(CLE_PERMISSION_NATIVE, depuisEtatNatif(display));
}

/** Demande la permission si elle n'a pas encore été accordée ni refusée, et renvoie l'état obtenu. */
export async function demanderPermissionNotifications(): Promise<NotifPermission> {
  if (Capacitor.isNativePlatform()) {
    try {
      let { display } = await LocalNotifications.checkPermissions();
      if (display !== "granted" && display !== "denied") {
        ({ display } = await LocalNotifications.requestPermissions());
      }
      const permission = depuisEtatNatif(display);
      ecrireBrut(CLE_PERMISSION_NATIVE, permission);
      return permission;
    } catch {
      return "denied";
    }
  }
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/** Identifiant numérique stable dérivé du `tag` : une nouvelle notification remplace la précédente du même type. */
function idDepuisTag(tag: string): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (Math.imul(31, h) + tag.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

/** Affiche une notification système (si la permission a été accordée). */
export function afficherNotification(titre: string, { body, tag }: { body: string; tag: string }): void {
  if (Capacitor.isNativePlatform()) {
    LocalNotifications.schedule({
      notifications: [{ id: idDepuisTag(tag), title: titre, body, largeBody: body }],
    }).catch((erreur: unknown) => console.error("Notification impossible", erreur));
    return;
  }
  try {
    new Notification(titre, { body, tag });
  } catch {
    /* certains navigateurs refusent la notification hors service worker */
  }
}
