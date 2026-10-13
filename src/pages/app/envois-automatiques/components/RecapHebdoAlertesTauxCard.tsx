import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  JOURS_SEMAINE,
  prochainRecapTauxHebdo,
  previewTauxAlerteRecapHebdo,
  runTauxAlerteRecapHebdoNow,
  updateTauxAlerteRecapHebdoSettings,
} from "@/lib/tauxAlerteRecapHebdo";
import { formatHorodatage } from "@/lib/diagnosticUi";

type EtatEnreg = "idle" | "enregistrement" | "enregistre" | "erreur";
type EtatAction = "idle" | "chargement" | "succes" | "erreur";

const JOUR_DEFAUT = 1;
const HEURE_DEFAUT = 8;

/** Libellé court d'une échéance (jour + heure). */
function libelleEcheance(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const jours = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${jours[d.getDay()]} ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à ${heure}`;
}

/**
 * Réglage du récapitulatif HEBDOMADAIRE des alertes de taux : un interrupteur, un jour de la
 * semaine et une heure. La tâche planifiée côté serveur expédie alors, une fois par semaine, un
 * email qui résume les alertes de taux (réelles et tests) envoyées dans les 7 derniers jours,
 * avec le détail des jours concernés. L'artisan peut prévisualiser l'email ou l'envoyer tout de
 * suite pour vérifier le rendu et la réception.
 */
export default function RecapHebdoAlertesTauxCard() {
  const { user, profile, refreshProfile } = useAuth();
  const [actif, setActif] = useState(false);
  const [jour, setJour] = useState<number>(JOUR_DEFAUT);
  const [heure, setHeure] = useState<number>(HEURE_DEFAUT);
  const [etat, setEtat] = useState<EtatEnreg>("idle");
  const [erreur, setErreur] = useState<string | null>(null);

  const [apercuOuvert, setApercuOuvert] = useState(false);
  const [apercuHtml, setApercuHtml] = useState<string | null>(null);
  const [apercuEtat, setApercuEtat] = useState<EtatAction>("idle");
  const [testEtat, setTestEtat] = useState<EtatAction>("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setActif(profile.taux_alerte_recap_hebdo_actif === true);
    const j = Number(profile.taux_alerte_recap_hebdo_jour);
    setJour(Number.isFinite(j) && j >= 1 && j <= 7 ? j : JOUR_DEFAUT);
    const h = Number(profile.taux_alerte_recap_hebdo_heure);
    setHeure(Number.isFinite(h) && h >= 0 && h <= 23 ? h : HEURE_DEFAUT);
  }, [profile]);

  const enregistrer = async (next: { actif: boolean; jour: number; heure: number }) => {
    if (!user) return;
    setEtat("enregistrement");
    setErreur(null);
    try {
      await updateTauxAlerteRecapHebdoSettings(user.id, next);
      await refreshProfile();
      setEtat("enregistre");
      window.setTimeout(() => setEtat("idle"), 1800);
    } catch {
      setEtat("erreur");
      setErreur("L'enregistrement du récap hebdomadaire a échoué. Réessayez.");
    }
  };

  const basculerActif = () => {
    const next = !actif;
    setActif(next);
    void enregistrer({ actif: next, jour, heure });
  };

  const changerJour = (value: number) => {
    setJour(value);
    if (actif) void enregistrer({ actif, jour: value, heure });
  };

  const changerHeure = (value: number) => {
    setHeure(value);
    if (actif) void enregistrer({ actif, jour, heure: value });
  };

  const ouvrirApercu = async () => {
    if (!user) return;
    setApercuOuvert(true);
    setApercuEtat("chargement");
    setApercuHtml(null);
    try {
      const res = await previewTauxAlerteRecapHebdo(user.id);
      setApercuHtml(res.html);
      setApercuEtat("succes");
    } catch {
      setApercuEtat("erreur");
    }
  };

  const lancerTest = async () => {
    if (!user) return;
    setTestEtat("chargement");
    setTestMessage(null);
    try {
      const res = await runTauxAlerteRecapHebdoNow(user.id);
      if (res.sent > 0) {
        setTestEtat("succes");
        setTestMessage("Le récap hebdomadaire vient d'être envoyé à votre adresse.");
        await refreshProfile();
      } else {
        setTestEtat("erreur");
        setTestMessage(res.reason || "L'envoi n'a pas abouti (Resend non configuré ou adresse manquante).");
      }
    } catch (e) {
      setTestEtat("erreur");
      setTestMessage(e instanceof Error ? e.message : "L'envoi du récap a échoué.");
    }
  };

  const dernierEnvoi = profile?.taux_alerte_recap_hebdo_dernier_envoi ?? null;
  const prochaine = useMemo(() => prochainRecapTauxHebdo(jour, heure), [jour, heure]);

  return (
    <div className="flex flex-col gap-4 p-5 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-lg">
            <i className="ri-mail-star-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-semibold text-base text-foreground-950">
              Récap hebdo des alertes de taux
            </h3>
            <p className="mt-0.5 text-xs text-foreground-600 max-w-xl leading-relaxed">
              Recevez chaque semaine un email qui résume les alertes de taux envoyées dans les
              derniers jours : nombre d'alertes, jours concernés, taux et seuils. Pratique pour garder
              une trace sans ouvrir l'application.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold ${actif ? "text-primary-700" : "text-foreground-400"}`}>
            {actif ? "Activé" : "Coupé"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={actif}
            aria-label="Activer ou couper le récap hebdomadaire des alertes de taux"
            onClick={basculerActif}
            disabled={etat === "enregistrement"}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
              actif ? "bg-primary-500" : "bg-background-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-background-50 shadow transition-transform ${
                actif ? "translate-x-5" : "translate-x-0.5"
              }`}
            ></span>
          </button>
        </div>
      </div>

      {actif && (
        <div className="flex flex-col gap-3 animate-fade-in">
          <div className="flex flex-wrap items-center gap-2 text-sm text-foreground-700">
            <span>Envoyer le récap chaque</span>
            <label className="inline-flex items-center gap-1 h-9 px-2.5 rounded-md bg-background-50 border border-background-200 font-semibold">
              <select
                value={jour}
                onChange={(e) => changerJour(Number(e.target.value))}
                disabled={etat === "enregistrement"}
                aria-label="Jour de la semaine d'envoi du récap"
                className="bg-transparent text-foreground-900 font-bold cursor-pointer outline-none"
              >
                {JOURS_SEMAINE.map((j) => (
                  <option key={j.value} value={j.value}>
                    {j.label}
                  </option>
                ))}
              </select>
            </label>
            <span>à</span>
            <label className="inline-flex items-center gap-1 h-9 px-2.5 rounded-md bg-background-50 border border-background-200 font-semibold">
              <select
                value={heure}
                onChange={(e) => changerHeure(Number(e.target.value))}
                disabled={etat === "enregistrement"}
                aria-label="Heure d'envoi du récap"
                className="bg-transparent text-foreground-900 font-bold cursor-pointer outline-none"
              >
                {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")} h
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="text-[11px] text-foreground-500 flex items-start gap-1.5 leading-relaxed">
            <i className="ri-information-line mt-px shrink-0"></i>
            <span>
              Prochain envoi prévu : <strong>{libelleEcheance(prochaine)}</strong> (heure de Paris).
              Le récap porte sur les 7 derniers jours (alertes réelles et tests).
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => { void ouvrirApercu(); }}
              disabled={apercuEtat === "chargement"}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <i className={apercuEtat === "chargement" ? "ri-loader-4-line animate-spin" : "ri-eye-line"}></i>
              Aperçu de l'email
            </button>
            <button
              type="button"
              onClick={() => { void lancerTest(); }}
              disabled={testEtat === "chargement"}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <i className={testEtat === "chargement" ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}></i>
              {testEtat === "chargement" ? "Envoi…" : "Tester maintenant"}
            </button>
          </div>

          {testEtat === "succes" && testMessage && (
            <p className="text-xs text-accent-700 flex items-center gap-1.5 animate-fade-in">
              <i className="ri-checkbox-circle-line"></i>
              {testMessage}
            </p>
          )}
          {testEtat === "erreur" && testMessage && (
            <p className="text-xs text-red-700 flex items-center gap-1.5">
              <i className="ri-error-warning-line"></i>
              {testMessage}
            </p>
          )}
        </div>
      )}

      {apercuOuvert && (
        <div className="flex flex-col gap-2 p-3 rounded-md bg-background-50 border border-background-200 animate-fade-in">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              <i className="ri-mail-line"></i>
              Aperçu de l'email
            </span>
            <button
              type="button"
              onClick={() => setApercuOuvert(false)}
              aria-label="Fermer l'aperçu"
              className="w-6 h-6 flex items-center justify-center rounded-md text-foreground-400 hover:text-foreground-700 hover:bg-background-200 cursor-pointer transition-colors"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
          {apercuEtat === "chargement" && (
            <p className="text-xs text-foreground-500 flex items-center gap-1.5 py-3">
              <i className="ri-loader-4-line animate-spin"></i>
              Construction de l'aperçu…
            </p>
          )}
          {apercuEtat === "erreur" && (
            <p className="text-xs text-red-700 flex items-center gap-1.5 py-3">
              <i className="ri-error-warning-line"></i>
              L'aperçu n'a pas pu être généré.
            </p>
          )}
          {apercuEtat === "succes" && apercuHtml && (
            <iframe
              title="Aperçu du récap hebdomadaire des alertes de taux"
              srcDoc={apercuHtml}
              sandbox=""
              className="w-full h-96 rounded-md border border-background-200 bg-background-50"
            />
          )}
        </div>
      )}

      {etat === "enregistre" && (
        <p className="text-xs text-accent-700 flex items-center gap-1.5 animate-fade-in">
          <i className="ri-checkbox-circle-line"></i>
          Réglage enregistré. La surveillance côté serveur suivra ce choix.
        </p>
      )}
      {etat === "erreur" && erreur && (
        <p className="text-xs text-red-700 flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {erreur}
        </p>
      )}
      {dernierEnvoi && (
        <p className="text-[11px] text-foreground-500 flex items-center gap-1.5">
          <i className="ri-mail-check-line"></i>
          Dernier récap hebdo envoyé le {formatHorodatage(dernierEnvoi)}.
        </p>
      )}
      {!actif && (
        <p className="text-xs text-foreground-500 flex items-center gap-1.5">
          <i className="ri-notification-off-line"></i>
          Récap coupé : vous ne recevrez pas la synthèse hebdomadaire des alertes de taux.
        </p>
      )}
    </div>
  );
}