import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRelancesDuJour } from "@/hooks/useRelancesDuJour";
import { todayISO } from "@/lib/dates";
import { afficherNotification, demanderPermissionNotifications, lirePermissionNotifications, notificationsDisponibles, type NotifPermission } from "@/lib/notificationsSysteme";

// Clé de mémorisation : le bandeau « relances du jour » masqué ne réapparaît pas avant le lendemain.
const VU_KEY = "artiflow.relances.jourJ.vu";
// Préférence de notification navigateur (en plus du bandeau in-app).
const NOTIF_NAV_KEY = "artiflow.relances.jourJ.notifNav";
// Date (ISO) de la dernière notification navigateur envoyée, pour n'alerter qu'une fois par jour.
const NOTIF_ENVOYEE_KEY = "artiflow.relances.jourJ.notifEnvoyee";


/**
 * Notification in-app affichée le jour J lorsqu'une ou plusieurs relances programmées
 * arrivent à échéance aujourd'hui. Permet d'ouvrir la page dédiée pour vérifier les
 * messages (aperçu) ou annuler avant l'envoi automatique. Masquable pour la journée.
 *
 * Comme pour les échecs d'envoi, le bandeau est doublé d'une notification système du
 * navigateur (une seule fois par jour) que l'artisan peut activer via la cloche.
 */
export default function RelanceDuJourBanner({ refreshKey }: { refreshKey?: string }) {
  const navigate = useNavigate();
  const { duJour, count } = useRelancesDuJour(refreshKey);
  const [hidden, setHidden] = useState(false);
  const [notifNav, setNotifNav] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotifPermission>(
    lirePermissionNotifications(),
  );

  useEffect(() => {
    setHidden(localStorage.getItem(VU_KEY) === todayISO());
    setNotifNav(localStorage.getItem(NOTIF_NAV_KEY) === "true");
  }, [refreshKey]);

  // Notification système : une seule fois par jour, quand des relances tombent aujourd'hui.
  useEffect(() => {
    if (count === 0 || !notifNav) return;
    if (lirePermissionNotifications() !== "granted") return;
    const jour = todayISO();
    if (localStorage.getItem(NOTIF_ENVOYEE_KEY) === jour) return;
    localStorage.setItem(NOTIF_ENVOYEE_KEY, jour);
    afficherNotification("ArtiFlow-pro · Relances du jour", {
      body: `${count} relance${count > 1 ? "s" : ""} programmée${count > 1 ? "s" : ""} aujourd'hui. Vérifiez ou prévisualisez avant l'envoi automatique.`,
      tag: "artiflow-relance-jourJ",
    });
  }, [count, notifNav]);

  // Bascule la notification navigateur. Au premier clic, demande la permission au navigateur.
  const toggleNotif = useCallback(async () => {
    if (!notificationsDisponibles()) return;
    if (notifNav) {
      setNotifNav(false);
      localStorage.setItem(NOTIF_NAV_KEY, "false");
      return;
    }
    const perm = await demanderPermissionNotifications();
    setNotifPermission(perm);
    const enabled = perm === "granted";
    setNotifNav(enabled);
    localStorage.setItem(NOTIF_NAV_KEY, String(enabled));
  }, [notifNav]);

  if (count === 0 || hidden) return null;

  const noms = duJour.slice(0, 3).map((r) => r.clientNom);
  const reste = count - noms.length;

  const dismiss = () => {
    localStorage.setItem(VU_KEY, todayISO());
    setHidden(true);
  };

  const notifTitle = notifNav
    ? "Désactiver la notification navigateur"
    : notifPermission === "denied"
      ? "Notifications bloquées par le navigateur"
      : "Activer la notification navigateur le jour J";

  return (
    <div className="mb-4 flex items-start justify-between gap-3 p-4 rounded-lg bg-accent-50 border border-accent-200">
      <div className="flex items-start gap-3 min-w-0">
        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-lg">
          <i className="ri-notification-badge-line"></i>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-accent-900">
            {count} relance{count > 1 ? "s" : ""} programmée{count > 1 ? "s" : ""} aujourd'hui
          </p>
          <p className="text-xs text-accent-800 mt-0.5">
            {noms.join(", ")}
            {reste > 0 ? ` et ${reste} autre${reste > 1 ? "s" : ""}` : ""} — vérifiez ou annulez avant l'envoi
            automatique.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => navigate("/app/relances-programmees")}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
            >
              <i className="ri-eye-line"></i>
              Voir et prévisualiser
            </button>
            <button
              type="button"
              onClick={toggleNotif}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[11px] font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                notifNav
                  ? "bg-background-50 text-accent-700 border-accent-300"
                  : "bg-background-50 text-foreground-600 border-background-200 hover:border-accent-300 hover:text-accent-700"
              }`}
            >
              <i className={notifNav ? "ri-notification-3-fill" : "ri-notification-off-line"}></i>
              {notifNav ? "Notification navigateur activée" : "Activer la notification navigateur"}
            </button>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        title={notifTitle}
        className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-accent-600 hover:bg-accent-100 cursor-pointer"
        aria-label="Masquer la notification pour aujourd'hui"
      >
        <i className="ri-close-line"></i>
      </button>
    </div>
  );
}