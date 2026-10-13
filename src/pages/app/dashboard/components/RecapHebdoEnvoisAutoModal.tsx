import { useEffect, useRef, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import { useAuth } from "@/hooks/useAuth";
import { useRecapHebdoEnvoisAuto } from "@/hooks/useRecapHebdoEnvoisAuto";
import { runRecapHebdoEnvoisNow, type EnvoisAutoRecapHebdoCc } from "@/lib/artisanApi";
import ApercuEnvoiModal from "@/pages/app/envois-automatiques/components/ApercuEnvoiModal";

/** Jours de la semaine proposés, indexés sur la convention du Backend (1 = lundi … 7 = dimanche). */
const JOURS: { value: number; label: string }[] = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 7, label: "Dimanche" },
];

/** Heures proposées pour l'envoi du récap hebdo (06:00 → 22:00, heure de Paris). */
const HEURES = Array.from({ length: 17 }, (_, i) => i + 6);

function formatHeure(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

/** Formate l'horodatage du dernier récap envoyé (« 07 oct. 2026 à 08:00 »). */
function formatDernierEnvoi(value?: string | null): string {
  if (!value) return "jamais encore";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "jamais encore";
  const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${date} à ${heure}`;
}

/** Vrai si la valeur ressemble à une adresse email valide. */
function emailValide(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

interface RecapHebdoEnvoisAutoModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modale de réglage du récapitulatif hebdomadaire des envois automatiques : interrupteur
 * d'activation, choix du jour et de l'heure, adresses mises en copie (Cc), aperçu du
 * rendu de l'email, et bouton pour se l'envoyer tout de suite afin de vérifier la
 * configuration. L'email contient la synthèse CSV en pièce jointe.
 */
export default function RecapHebdoEnvoisAutoModal({ open, onClose }: RecapHebdoEnvoisAutoModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const { actif, jour, heure, cc, toggleActif, changeJour, changeHeure, setCc } = useRecapHebdoEnvoisAuto();
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apercuOpen, setApercuOpen] = useState(false);

  // Brouillon local des adresses en copie, pour ne pas enregistrer à chaque frappe.
  const [ccDraft, setCcDraft] = useState<EnvoisAutoRecapHebdoCc[]>(cc);
  const initialiseRef = useRef(false);
  useEffect(() => {
    if (!open) {
      initialiseRef.current = false;
      return;
    }
    if (!initialiseRef.current) {
      setCcDraft(cc.length ? cc.map((a) => ({ ...a })) : [{ nom: "", email: "" }]);
      initialiseRef.current = true;
    }
  }, [open, cc]);

  const commitCc = (liste: EnvoisAutoRecapHebdoCc[]) => {
    setCc(liste.map((a) => ({ nom: a.nom?.trim() || undefined, email: a.email.trim() })));
  };

  const majLigne = (index: number, patch: Partial<EnvoisAutoRecapHebdoCc>) => {
    setCcDraft((prev) => prev.map((ligne, i) => (i === index ? { ...ligne, ...patch } : ligne)));
  };

  const ajouterLigne = () => {
    setCcDraft((prev) => [...prev, { nom: "", email: "" }]);
  };

  const retirerLigne = (index: number) => {
    setCcDraft((prev) => {
      const next = prev.filter((_, i) => i !== index);
      commitCc(next);
      return next.length ? next : [{ nom: "", email: "" }];
    });
  };

  const adressesValides = cc.filter((a) => emailValide(a.email));

  const handleTest = async () => {
    if (!user || running) return;
    setRunning(true);
    setNotice(null);
    setError(null);
    try {
      const res = await runRecapHebdoEnvoisNow(user.id);
      if (!res.configured) {
        setError(
          `Email non envoyé : Resend n'est pas encore configuré (clé API + domaine d'envoi). ${
            res.reason ?? ""
          }`.trim(),
        );
      } else if (res.sent > 0) {
        setNotice("Récap hebdomadaire envoyé à votre adresse email. Vérifiez votre boîte mail.");
        await refreshProfile();
      } else {
        setNotice(
          `Aucun email envoyé : adresse email manquante ou envoi refusé. ${res.reason ?? ""}`.trim(),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'envoi du récap hebdomadaire a échoué.");
    } finally {
      setRunning(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      title="Récap hebdomadaire par email"
      subtitle="Recevez une fois par semaine la synthèse de vos envois automatiques (CSV en pièce jointe)."
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-background-100 border border-background-200">
          <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700 text-lg">
            <i className="ri-calendar-schedule-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-950">Envoi automatique hebdomadaire</p>
            <p className="text-xs text-foreground-600 mt-0.5">
              L'email résume l'état de toutes vos automatisations (à jour / à vérifier / inactives) et joint la
              synthèse CSV complète.
            </p>
            <p className="text-[11px] text-foreground-400 mt-1.5 inline-flex items-center gap-1.5">
              <i className="ri-history-line"></i>
              Dernier envoi réel&nbsp;:{" "}
              <strong className="text-foreground-600">
                {formatDernierEnvoi(profile?.envois_auto_recap_hebdo_dernier_envoi)}
              </strong>
            </p>
          </div>
        </div>

        {/* Interrupteur activer/couper */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={actif}
            onClick={toggleActif}
            title={actif ? "Couper le récap hebdomadaire par email" : "Activer le récap hebdomadaire par email"}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              actif ? "bg-primary-500 text-background-50" : "bg-background-50 text-foreground-500 border border-background-200"
            }`}
          >
            <i className={actif ? "ri-toggle-line text-base" : "ri-toggle-line text-base opacity-60"}></i>
            {actif ? "Récap hebdo activé" : "Récap hebdo coupé"}
          </button>
          <span className="text-[11px] text-foreground-400">
            {actif
              ? `Envoi chaque ${(JOURS.find((j) => j.value === jour)?.label ?? "lundi").toLowerCase()} à ${formatHeure(heure)}.`
              : "Aucun email récap ne sera envoyé tant qu'il est coupé."}
          </span>
        </div>

        {/* Jour et heure d'envoi */}
        <div className="flex flex-wrap items-center gap-2">
          <label
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold ${
              actif ? "bg-background-50 border-background-200 text-foreground-700" : "bg-background-50 border-background-200 text-foreground-400"
            }`}
            title="Jour de la semaine d'envoi"
          >
            <i className="ri-calendar-line"></i>
            Jour
            <select
              value={jour}
              onChange={(e) => changeJour(Number(e.target.value))}
              disabled={!actif}
              className="bg-transparent text-xs font-semibold text-foreground-900 outline-none cursor-pointer disabled:cursor-not-allowed"
              aria-label="Jour d'envoi du récap hebdomadaire"
            >
              {JOURS.map((j) => (
                <option key={j.value} value={j.value}>
                  {j.label}
                </option>
              ))}
            </select>
          </label>

          <label
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold ${
              actif ? "bg-background-50 border-background-200 text-foreground-700" : "bg-background-50 border-background-200 text-foreground-400"
            }`}
            title="Heure d'envoi (heure de Paris)"
          >
            <i className="ri-time-line"></i>
            Heure
            <select
              value={heure}
              onChange={(e) => changeHeure(Number(e.target.value))}
              disabled={!actif}
              className="bg-transparent text-xs font-semibold text-foreground-900 outline-none cursor-pointer disabled:cursor-not-allowed"
              aria-label="Heure d'envoi du récap hebdomadaire"
            >
              {HEURES.map((h) => (
                <option key={h} value={h}>
                  {formatHeure(h)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Adresses en copie (Cc) */}
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-background-100 border border-background-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-800">
              <i className="ri-mail-add-line text-secondary-700"></i>
              Adresses en copie (Cc)
            </span>
            <button
              type="button"
              onClick={ajouterLigne}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
            >
              <i className="ri-add-line"></i>
              Ajouter une adresse
            </button>
          </div>
          <p className="text-[11px] text-foreground-500 leading-relaxed">
            Chaque récap hebdo est envoyé à votre adresse et en <strong>copie (Cc)</strong> à ces destinataires
            (comptable, collaborateur…). Laissez vide pour envoyer uniquement à vous.
          </p>
          <div className="flex flex-col gap-2">
            {ccDraft.map((ligne, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={ligne.nom ?? ""}
                  onChange={(e) => majLigne(index, { nom: e.target.value })}
                  onBlur={() => commitCc(ccDraft)}
                  placeholder="Libellé (optionnel)"
                  aria-label={`Libellé de l'adresse en copie ${index + 1}`}
                  className="h-9 w-full sm:w-40 px-3 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <input
                  type="email"
                  value={ligne.email}
                  onChange={(e) => majLigne(index, { email: e.target.value })}
                  onBlur={() => commitCc(ccDraft)}
                  placeholder="adresse@exemple.fr"
                  aria-label={`Adresse email en copie ${index + 1}`}
                  className={`h-9 flex-1 min-w-[180px] px-3 rounded-md bg-background-50 border text-xs text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                    ligne.email.trim() && !emailValide(ligne.email) ? "border-red-300" : "border-background-200"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => retirerLigne(index)}
                  title="Retirer cette adresse"
                  aria-label="Retirer cette adresse en copie"
                  className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-foreground-500 cursor-pointer hover:border-red-300 hover:text-red-600 transition-colors"
                >
                  <i className="ri-delete-bin-line"></i>
                </button>
              </div>
            ))}
          </div>
          {adressesValides.length > 0 && (
            <p className="text-[11px] text-secondary-700 inline-flex items-center gap-1.5">
              <i className="ri-checkbox-circle-line"></i>
              {adressesValides.length} adresse{adressesValides.length > 1 ? "s" : ""} recevront une copie
              {adressesValides.length > 1 ? " " : ""}de chaque envoi.
            </p>
          )}
        </div>

        {notice && (
          <p className="text-xs text-accent-700 flex items-center gap-1.5">
            <i className="ri-checkbox-circle-line"></i>
            {notice}
          </p>
        )}
        {error && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {error}
          </p>
        )}

        <p className="text-[11px] text-foreground-400 flex items-start gap-1.5">
          <i className="ri-information-line mt-px shrink-0"></i>
          L'envoi automatique nécessite Resend configuré (clé API + domaine d'envoi vérifié). En attendant, l'aperçu
          ci-dessous vous montre le rendu exact, et le bouton de test vous indiquera l'état de la configuration.
        </p>
      </div>

      <div className="flex flex-wrap justify-end gap-2 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors"
        >
          Fermer
        </button>
        <button
          type="button"
          onClick={() => {
            commitCc(ccDraft);
            setApercuOpen(true);
          }}
          title="Voir l'email tel qu'il sera envoyé, sans rien expédier"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
        >
          <i className="ri-eye-line text-accent-600"></i>
          Aperçu de l'email
        </button>
        <button
          type="button"
          onClick={() => { void handleTest(); }}
          disabled={running || !user}
          title="Recevoir tout de suite le récap hebdomadaire à votre adresse email"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60"
        >
          {running ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
          {running ? "Envoi en cours…" : "Tester maintenant"}
        </button>
      </div>

      {apercuOpen && user && (
        <ApercuEnvoiModal
          itemId="recap-hebdo-envois-auto"
          nom="Récap hebdo des envois automatiques"
          userId={user.id}
          onClose={() => setApercuOpen(false)}
        />
      )}
    </Modal>
  );
}