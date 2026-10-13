import { useState } from "react";
import {
  SURVEILLANCE_OPTIONS,
  SEUIL_ALERTE_OPTIONS,
  type NotifPermission,
} from "@/hooks/useEchecsSurveillance";
import { envoyerAlerteReessaiEchec } from "@/lib/echecsEnvoi";

interface Props {
  /** Fréquence de vérification en arrière-plan en minutes (0 = désactivée). */
  freq: number;
  /** Bandeau d'alerte in-app affiché ou non. */
  bandeau: boolean;
  /** Notification navigateur activée ou non. */
  notifNav: boolean;
  /** Permission navigateur courante. */
  notifPermission: NotifPermission;
  /** Seuil d'échecs consécutifs déclenchant l'email d'alerte (2 / 3 / 5). */
  seuilAlerte: number;
  onChangeFreq: (value: number) => void;
  onToggleBandeau: () => void;
  onToggleNotif: () => void;
  onChangeSeuilAlerte: (value: number) => void;
}

/**
 * Réglage de surveillance des échecs : fréquence de vérification en arrière-plan,
 * bandeau d'alerte in-app, notification navigateur, seuil d'alerte email réglable et
 * bouton « Tester l'alerte » (email de démonstration). Partagé entre la page Relances
 * et le tableau de bord pour piloter la surveillance depuis n'importe où.
 */
export default function SurveillanceEchecsReglage({
  freq,
  bandeau,
  notifNav,
  notifPermission,
  seuilAlerte,
  onChangeFreq,
  onToggleBandeau,
  onToggleNotif,
  onChangeSeuilAlerte,
}: Props) {
  const notifDenied = notifPermission === "denied";
  const [testEnCours, setTestEnCours] = useState(false);
  const [testMessage, setTestMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  // Envoie un email de démonstration pour vérifier le rendu de l'alerte, sans attendre
  // plusieurs échecs consécutifs. Le rendu et l'envoi sont gérés côté Backend.
  const handleTestAlerte = async () => {
    if (testEnCours) return;
    setTestEnCours(true);
    setTestMessage(null);
    const res = await envoyerAlerteReessaiEchec({ test: true, seuil: seuilAlerte });
    if (res.sent) {
      setTestMessage({ ok: true, texte: "Email de test envoyé — vérifiez votre boîte de réception." });
    } else {
      setTestMessage({
        ok: false,
        texte: res.reason || "L'email de test n'a pas pu être envoyé. Vérifiez la configuration d'envoi.",
      });
    }
    setTestEnCours(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
          <i className="ri-radar-line"></i>
          Surveillance des échecs :
        </span>
        <div className="flex gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200">
          {SURVEILLANCE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChangeFreq(o.value)}
              title={
                o.value === 0
                  ? "Couper la surveillance automatique des échecs"
                  : `Vérifier les nouveaux échecs toutes les ${o.label}`
              }
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                freq === o.value
                  ? o.value === 0
                    ? "bg-red-500 text-white"
                    : "bg-secondary-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={bandeau}
          onClick={onToggleBandeau}
          disabled={freq <= 0}
          title="Afficher ou masquer le bandeau d'alerte quand un nouvel échec est détecté"
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            bandeau && freq > 0
              ? "bg-accent-100 text-accent-800"
              : "bg-background-100 text-foreground-500 border border-background-200"
          }`}
        >
          <i className={bandeau ? "ri-notification-3-line" : "ri-notification-off-line"}></i>
          Bandeau {bandeau ? "activé" : "coupé"}
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={notifNav}
          onClick={onToggleNotif}
          disabled={freq <= 0 || notifDenied}
          title={
            notifDenied
              ? "Les notifications sont bloquées dans le navigateur. Autorisez-les dans les réglages du site."
              : "Recevoir une notification du navigateur quand un nouvel échec est détecté, même sur un autre onglet"
          }
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            notifNav && freq > 0
              ? "bg-primary-100 text-primary-800"
              : "bg-background-100 text-foreground-500 border border-background-200"
          }`}
        >
          <i className={notifNav ? "ri-notification-badge-line" : "ri-notification-off-line"}></i>
          Notif navigateur {notifNav ? "activée" : "coupée"}
        </button>
        <span className="text-[11px] text-foreground-400">
          {notifDenied
            ? "Notifications bloquées par le navigateur."
            : freq <= 0
              ? "Surveillance en pause — les nouveaux échecs ne sont plus détectés automatiquement."
              : "Vérifie les nouveaux échecs en arrière-plan, sans recharger la page."}
        </span>
      </div>

      {/* Seuil d'alerte email réglable + test du rendu */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
          <i className="ri-alarm-warning-line"></i>
          Alerte email après :
        </span>
        <div className="flex gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200">
          {SEUIL_ALERTE_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChangeSeuilAlerte(s)}
              title={`Prévenir par email au bout de ${s} échec${s > 1 ? "s" : ""} consécutif${s > 1 ? "s" : ""}`}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                seuilAlerte === s
                  ? "bg-secondary-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              {s} échec{s > 1 ? "s" : ""}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { void handleTestAlerte(); }}
          disabled={testEnCours}
          title="Recevoir un email de démonstration pour vérifier le rendu de l'alerte"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors bg-background-100 text-foreground-600 border border-background-200 hover:bg-background-200 disabled:opacity-60"
        >
          <i className={testEnCours ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}></i>
          Tester l'alerte
        </button>
        {testMessage && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] ${
              testMessage.ok ? "text-accent-700" : "text-red-700"
            }`}
          >
            <i className={testMessage.ok ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
            {testMessage.texte}
          </span>
        )}
      </div>
    </div>
  );
}