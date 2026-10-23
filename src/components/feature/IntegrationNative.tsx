import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { App as AppNative } from "@capacitor/app";
import { supabase } from "@/lib/supabase";
import { actualiserPermissionNotifications } from "@/lib/notificationsSysteme";

/**
 * Lien https://artiflow.pro/… ouvert dans l'application (lien magique, réinitialisation du mot
 * de passe, retour de paiement…). Les jetons d'authentification placés dans le fragment par
 * Supabase ouvrent la session ; le reste de l'adresse devient un chemin interne.
 */
async function cheminDepuisLien(lien: string): Promise<string> {
  const url = new URL(lien);
  const base = (__BASE_PATH__ || "").replace(/\/+$/, "");
  const chemin = base && url.pathname.startsWith(base) ? url.pathname.slice(base.length) || "/" : url.pathname;

  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  const access_token = fragment.get("access_token");
  const refresh_token = fragment.get("refresh_token");
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) console.error("Ouverture de session depuis le lien impossible", error);
    return `${chemin}${url.search}`;
  }
  return `${chemin}${url.search}${url.hash}`;
}

/**
 * Comportements propres à l'application mobile (Capacitor) : bouton retour Android, ouverture
 * des liens du site directement dans l'application et suivi de la permission de notification
 * (modifiable dans les réglages du téléphone). Ne fait rien sur le web.
 */
export default function IntegrationNative() {
  const navigate = useNavigate();
  const location = useLocation();
  // `navigate` change à chaque page : on garde la dernière version sans réinscrire les écouteurs.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (Capacitor.isNativePlatform() && location.pathname === "/") {
      navigate("/app", { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void actualiserPermissionNotifications();
    const ecouteurs: Promise<PluginListenerHandle>[] = [
      AppNative.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else void AppNative.exitApp();
      }),
      AppNative.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void actualiserPermissionNotifications();
      }),
      AppNative.addListener("appUrlOpen", ({ url }) => {
        cheminDepuisLien(url)
          .then((chemin) => navigateRef.current(chemin, { replace: true }))
          .catch((erreur: unknown) => console.error("Lien non reconnu", url, erreur));
      }),
    ];
    return () => {
      ecouteurs.forEach((ecouteur) => void ecouteur.then((h) => h.remove()));
    };
  }, []);

  return null;
}
