import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  JOURS_RECAP_CHANTIERS,
  adressesCcActives,
  envoyerRecapChantiersMaintenant,
  fetchRecapChantiersSettings,
  libelleJourRecap,
  updateRecapChantiersSettings,
  type AdresseCcRecap,
  type RecapChantiersSettings,
} from "@/lib/suiviChantier";
import ApercuRecapChantiersModal from "@/pages/app/chantiers/components/ApercuRecapChantiersModal";

/** Heures d'envoi proposées pour le récap (heure de Paris). */
const HEURES = [6, 7, 8, 9, 12, 17, 18, 19] as const;

type Feedback = { ton: "ok" | "ko"; texte: string } | null;

/** Contrôle simple d'une adresse email saisie pour la copie. */
function emailValide(valeur: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valeur.trim());
}

/**
 * Carte de réglage du récapitulatif hebdomadaire : chaque semaine, l'artisan reçoit par email
 * l'avancement de tous ses chantiers en cours. Il choisit le jour et l'heure, peut voir le
 * rendu exact avant envoi, et l'expédier tout de suite pour se rassurer.
 */
export default function RecapHebdoChantiersCard() {
  const { user } = useAuth();
  const [reglages, setReglages] = useState<RecapChantiersSettings | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [apercu, setApercu] = useState(false);
  // Adresses mises en copie du récap (comptable, associé, banque…) : plusieurs possibles,
  // chacune incluse ou non, l'une d'elles marquée « par défaut ».
  const [ccs, setCcs] = useState<AdresseCcRecap[]>([]);
  const [nouvelleCc, setNouvelleCc] = useState("");

  const charger = useCallback(async () => {
    if (!user?.id) return;
    try {
      const values = await fetchRecapChantiersSettings(user.id);
      setReglages(values);
      setCcs(values.ccs);
      setErreur(null);
    } catch {
      setErreur("Les réglages du récap n'ont pas pu être chargés.");
    }
  }, [user?.id]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const signaler = (ton: "ok" | "ko", texte: string) => {
    setFeedback({ ton, texte });
    window.setTimeout(() => setFeedback(null), 6000);
  };

  const basculer = async () => {
    if (!user?.id || !reglages) return;
    const cible = !reglages.actif;
    setBusy("actif");
    setReglages({ ...reglages, actif: cible });
    try {
      await updateRecapChantiersSettings(user.id, { actif: cible });
      signaler(
        "ok",
        cible
          ? `Récap réactivé : vous le recevrez chaque ${libelleJourRecap(reglages.jour).toLowerCase()}.`
          : "Récap désactivé.",
      );
    } catch {
      setReglages({ ...reglages, actif: !cible });
      signaler("ko", "Le réglage n'a pas pu être enregistré.");
    } finally {
      setBusy(null);
    }
  };

  const changerJour = async (jour: number) => {
    if (!user?.id || !reglages) return;
    const avant = reglages.jour;
    setBusy("jour");
    setReglages({ ...reglages, jour });
    try {
      await updateRecapChantiersSettings(user.id, { jour });
      signaler(
        "ok",
        `Récap déplacé au ${libelleJourRecap(jour).toLowerCase()} à ${String(reglages.heure).padStart(2, "0")}:00.`,
      );
    } catch {
      setReglages({ ...reglages, jour: avant });
      signaler("ko", "Le jour n'a pas pu être enregistré.");
    } finally {
      setBusy(null);
    }
  };

  const changerHeure = async (heure: number) => {
    if (!user?.id || !reglages) return;
    const avant = reglages.heure;
    setBusy("heure");
    setReglages({ ...reglages, heure });
    try {
      await updateRecapChantiersSettings(user.id, { heure });
      signaler(
        "ok",
        `Récap envoyé le ${libelleJourRecap(reglages.jour).toLowerCase()} à ${String(heure).padStart(2, "0")}:00.`,
      );
    } catch {
      setReglages({ ...reglages, heure: avant });
      signaler("ko", "L'heure n'a pas pu être enregistrée.");
    } finally {
      setBusy(null);
    }
  };

  /** Garantit qu'une seule adresse est « par défaut » et qu'elle reste incluse. */
  const avecDefautCoherent = (liste: AdresseCcRecap[]): AdresseCcRecap[] => {
    const actives = liste.filter((a) => a.actif);
    const defaut = liste.find((a) => a.parDefaut && a.actif) ?? actives[0] ?? null;
    return liste.map((a) => ({ ...a, parDefaut: defaut ? a.email === defaut.email : false }));
  };

  /** Enregistre la liste d'adresses en copie et garde l'écran cohérent. */
  const sauvegarderCcs = async (liste: AdresseCcRecap[], message: string) => {
    if (!user?.id) return;
    const avant = ccs;
    setBusy("cc");
    setCcs(liste);
    try {
      await updateRecapChantiersSettings(user.id, { ccs: liste });
      setReglages((prev) => (prev ? { ...prev, ccs: liste } : prev));
      signaler("ok", message);
    } catch {
      setCcs(avant);
      signaler("ko", "Les adresses en copie n'ont pas pu être enregistrées.");
    } finally {
      setBusy(null);
    }
  };

  const ajouterCc = async () => {
    const propre = nouvelleCc.trim();
    if (!propre) return;
    if (!emailValide(propre)) {
      signaler("ko", "Cette adresse email ne semble pas valide.");
      return;
    }
    if (ccs.some((a) => a.email.toLowerCase() === propre.toLowerCase())) {
      signaler("ko", "Cette adresse est déjà dans la liste.");
      return;
    }
    const suivante = avecDefautCoherent([...ccs, { email: propre, actif: true, parDefaut: false }]);
    setNouvelleCc("");
    await sauvegarderCcs(suivante, `${propre} recevra désormais une copie du récap.`);
  };

  const basculerCc = async (email: string) => {
    const suivante = ccs.map((a) => (a.email === email ? { ...a, actif: !a.actif } : a));
    await sauvegarderCcs(avecDefautCoherent(suivante), "Liste des copies mise à jour.");
  };

  const definirDefautCc = async (email: string) => {
    const suivante = ccs.map((a) => ({
      ...a,
      actif: a.email === email ? true : a.actif,
      parDefaut: a.email === email,
    }));
    await sauvegarderCcs(suivante, `${email} est l'adresse en copie par défaut.`);
  };

  const supprimerCc = async (email: string) => {
    const suivante = avecDefautCoherent(ccs.filter((a) => a.email !== email));
    await sauvegarderCcs(suivante, `${email} ne recevra plus de copie.`);
  };

  const envoyerMaintenant = async () => {
    if (!user?.id) return;
    setBusy("envoi");
    try {
      const resultat = await envoyerRecapChantiersMaintenant(user.id);
      if (!resultat.configure) {
        signaler("ko", "L'envoi d'email n'est pas encore configuré.");
      } else if (resultat.sent > 0) {
        signaler("ok", "Récap envoyé : regardez votre boîte mail.");
        await charger();
      } else {
        signaler("ko", resultat.reason ?? "Le récap n'a pas pu être envoyé.");
      }
    } catch (e) {
      signaler("ko", e instanceof Error ? e.message : "Le récap n'a pas pu être envoyé.");
    } finally {
      setBusy(null);
    }
  };

  const jourLibelle = libelleJourRecap(reglages?.jour ?? 5);
  const adressesActives = adressesCcActives(ccs);
  const dernierEnvoi = reglages?.dernierEnvoi
    ? new Date(reglages.dernierEnvoi).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="p-4 rounded-lg bg-accent-50 border border-accent-100">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
            <i className="ri-calendar-check-line text-base"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-900">Récap hebdo des chantiers</p>
            <p className="text-[11px] text-foreground-600 leading-relaxed">
              Chaque semaine, recevez par email l'avancement de tous vos chantiers en cours.
              {dernierEnvoi ? ` Dernier envoi : ${dernierEnvoi}.` : " Aucun envoi pour l'instant."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <label className="inline-flex items-center gap-1.5 text-[11px] text-foreground-600">
            <span className="whitespace-nowrap">le</span>
            <select
              value={reglages?.jour ?? 5}
              onChange={(e) => changerJour(Number(e.target.value))}
              disabled={busy === "jour" || !reglages}
              aria-label="Jour d'envoi du récap hebdomadaire des chantiers"
              className="h-8 px-2 rounded-md bg-background-50 border border-accent-200 text-xs text-foreground-800 outline-none cursor-pointer disabled:opacity-60"
            >
              {JOURS_RECAP_CHANTIERS.map((j) => (
                <option key={j.valeur} value={j.valeur}>
                  {j.libelle}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex items-center gap-1.5 text-[11px] text-foreground-600">
            <span className="whitespace-nowrap">à</span>
            <select
              value={reglages?.heure ?? 8}
              onChange={(e) => changerHeure(Number(e.target.value))}
              disabled={busy === "heure" || !reglages}
              aria-label="Heure d'envoi du récap hebdomadaire des chantiers"
              className="h-8 px-2 rounded-md bg-background-50 border border-accent-200 text-xs text-foreground-800 outline-none cursor-pointer disabled:opacity-60"
            >
              {HEURES.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={basculer}
            disabled={busy === "actif" || !reglages}
            aria-pressed={Boolean(reglages?.actif)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              reglages?.actif
                ? "bg-accent-500 text-background-50 hover:bg-accent-600"
                : "bg-background-200 text-foreground-600 hover:bg-background-300"
            }`}
          >
            <i className={reglages?.actif ? "ri-toggle-line" : "ri-toggle-fill"}></i>
            {reglages?.actif ? "Activé" : "Désactivé"}
          </button>

          <button
            type="button"
            onClick={() => setApercu(true)}
            disabled={!reglages}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-accent-200 text-xs font-semibold text-foreground-800 whitespace-nowrap cursor-pointer hover:bg-accent-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className="ri-eye-line"></i>
            Aperçu de l'email
          </button>

          <button
            type="button"
            onClick={() => void envoyerMaintenant()}
            disabled={busy === "envoi"}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-accent-200 text-xs font-semibold text-foreground-800 whitespace-nowrap cursor-pointer hover:bg-accent-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={busy === "envoi" ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}></i>
            Envoyer maintenant
          </button>
        </div>
      </div>

      <div className="mt-3 p-3 rounded-md bg-background-50 border border-accent-200">
        <div className="flex flex-wrap items-center gap-1.5">
          <i className="ri-mail-add-line text-accent-700 text-sm"></i>
          <p className="text-[11px] font-semibold text-foreground-700">
            Copies du récap <span className="font-normal text-foreground-500">(comptable, associé… — facultatif)</span>
          </p>
          {adressesActives.length > 0 && (
            <span className="ml-auto inline-flex items-center h-5 px-2 rounded-full bg-accent-100 text-accent-900 text-[10px] font-bold whitespace-nowrap">
              {adressesActives.length} adresse{adressesActives.length > 1 ? "s" : ""} incluse{adressesActives.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {ccs.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {ccs.map((a) => (
              <li
                key={a.email}
                className="flex flex-wrap items-center gap-2 rounded-md bg-background-100 border border-background-200 px-2.5 py-1.5"
              >
                <label className="inline-flex items-center gap-1.5 min-w-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={a.actif}
                    onChange={() => void basculerCc(a.email)}
                    disabled={busy === "cc"}
                    aria-label={`Inclure ${a.email} dans les copies du récap`}
                    className="w-3.5 h-3.5 shrink-0 accent-accent-600 cursor-pointer"
                  />
                  <span
                    className={`text-xs truncate ${a.actif ? "text-foreground-900 font-semibold" : "text-foreground-500"}`}
                    title={a.email}
                  >
                    {a.email}
                  </span>
                </label>
                {a.parDefaut ? (
                  <span
                    className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-100 text-accent-900 text-[10px] font-bold whitespace-nowrap"
                    title="Adresse proposée en premier et toujours cochée"
                  >
                    <i className="ri-star-fill"></i>
                    Par défaut
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void definirDefautCc(a.email)}
                    disabled={busy === "cc"}
                    title="Faire de cette adresse l'adresse en copie par défaut"
                    className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50 border border-background-200 text-[10px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="ri-star-line"></i>
                    Par défaut
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void supprimerCc(a.email)}
                  disabled={busy === "cc"}
                  title={`Retirer ${a.email}`}
                  aria-label={`Retirer ${a.email}`}
                  className="ml-auto w-6 h-6 flex items-center justify-center rounded-md text-foreground-400 hover:bg-red-50 hover:text-red-600 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="ri-close-line text-sm"></i>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-2 flex flex-col sm:flex-row sm:items-end gap-2">
          <div className="flex-1 min-w-0">
            <label htmlFor="recap-chantiers-cc" className="text-[11px] font-semibold text-foreground-600">
              Ajouter une adresse
            </label>
            <input
              id="recap-chantiers-cc"
              type="email"
              value={nouvelleCc}
              onChange={(e) => setNouvelleCc(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void ajouterCc();
                }
              }}
              placeholder="comptable@cabinet.fr"
              autoComplete="off"
              className="mt-1 w-full h-9 px-3 rounded-md bg-background-100 border border-background-200 text-xs text-foreground-800 outline-none focus:border-accent-400"
            />
          </div>
          <button
            type="button"
            onClick={() => void ajouterCc()}
            disabled={busy === "cc" || !nouvelleCc.trim()}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className={busy === "cc" ? "ri-loader-4-line animate-spin" : "ri-add-line"}></i>
            Ajouter
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-foreground-500 leading-relaxed">
          Cochez les adresses qui reçoivent une copie. L'adresse « par défaut » est proposée en premier et reste
          toujours cochée — les autres peuvent être décrochées d'un clic.
        </p>
      </div>

      <p className="mt-2 text-[11px] text-foreground-500 inline-flex items-center gap-1.5 flex-wrap">
        <i className="ri-information-line"></i>
        Prochain envoi automatique : {jourLibelle.toLowerCase()} à{" "}
        {String(reglages?.heure ?? 8).padStart(2, "0")}:00{reglages?.actif === false ? " (récap désactivé)" : ""}.
        {adressesActives.length > 0 ? (
          <span className="inline-flex items-center gap-1 text-accent-800 font-semibold">
            <i className="ri-mail-add-line"></i>
            Copie à {adressesActives.join(", ")}
          </span>
        ) : null}
      </p>

      {erreur && (
        <p className="mt-2 text-[11px] text-red-600 flex items-start gap-1.5">
          <i className="ri-error-warning-line mt-0.5"></i>
          {erreur}
        </p>
      )}

      {feedback && (
        <p
          className={`mt-2 text-[11px] flex items-start gap-1.5 ${
            feedback.ton === "ok" ? "text-accent-800" : "text-red-600"
          }`}
        >
          <i className={feedback.ton === "ok" ? "ri-checkbox-circle-line mt-0.5" : "ri-error-warning-line mt-0.5"}></i>
          <span>{feedback.texte}</span>
        </p>
      )}

      {apercu && user?.id && (
        <ApercuRecapChantiersModal
          userId={user.id}
          envoiEnCours={busy === "envoi"}
          onEnvoyer={async () => {
            await envoyerMaintenant();
            setApercu(false);
          }}
          onClose={() => setApercu(false)}
        />
      )}
    </div>
  );
}