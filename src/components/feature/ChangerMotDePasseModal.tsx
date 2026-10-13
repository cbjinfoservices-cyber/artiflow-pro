import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { validerMotDePasseFort, verifierMotDePasseActuel } from "@/lib/motDePasse";
import { translateAuthError } from "@/pages/app/auth/errors";
import Modal from "@/pages/app/components/Modal";
import IndicateurForceMotDePasse from "@/components/base/IndicateurForceMotDePasse";
import IndicateurCorrespondanceMdp from "@/pages/app/auth/components/IndicateurCorrespondanceMdp";

const champCls =
  "h-11 w-full rounded-md border border-background-200 bg-background-50 pl-9 pr-10 text-sm text-foreground-950 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400";

/**
 * Fenêtre « Modifier mon mot de passe » pour un utilisateur déjà connecté.
 * Le mot de passe actuel est vérifié avant d'appliquer le nouveau.
 *
 * Composant partagé : utilisable depuis le profil (espace artisan), l'alerte de sécurité du
 * tableau de bord et le menu du compte en haut à droite.
 */
export default function ChangerMotDePasseModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!actuel) {
      setError("Saisissez votre mot de passe actuel.");
      return;
    }
    const erreurForce = validerMotDePasseFort(nouveau);
    if (erreurForce) {
      setError(erreurForce);
      return;
    }
    if (nouveau !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (nouveau === actuel) {
      setError("Choisissez un mot de passe différent de l'actuel.");
      return;
    }
    setBusy(true);
    try {
      const email = user?.email;
      if (email) {
        const ok = await verifierMotDePasseActuel(email, actuel);
        if (!ok) {
          setError("Votre mot de passe actuel est incorrect.");
          return;
        }
      }
      const { error: majError } = await supabase.auth.updateUser({ password: nouveau });
      if (majError) {
        setError(translateAuthError(majError.message));
        return;
      }
      setSucces(true);
      onSuccess?.();
    } catch (e) {
      setError(translateAuthError(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  };

  if (succes) {
    return (
      <Modal title="Mot de passe modifié" onClose={onClose}>
        <div className="flex flex-col items-center text-center gap-4 py-2">
          <span className="w-14 h-14 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
            <i className="ri-shield-check-line text-2xl"></i>
          </span>
          <p className="text-sm text-foreground-500 leading-relaxed">
            Votre nouveau mot de passe est actif. Utilisez-le dès votre prochaine connexion.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-check-line"></i>
            Fermer
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Modifier mon mot de passe"
      subtitle="Pour votre sécurité, confirmez d'abord votre mot de passe actuel."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <i className="ri-error-warning-line mt-0.5"></i>
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="mdp-actuel" className="text-xs font-semibold text-foreground-700">
            Mot de passe actuel
          </label>
          <div className="relative">
            <i className="ri-lock-2-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
            <input
              id="mdp-actuel"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={actuel}
              onChange={(e) => setActuel(e.target.value)}
              placeholder="Votre mot de passe actuel"
              className={champCls}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="mdp-nouveau" className="text-xs font-semibold text-foreground-700">
            Nouveau mot de passe
          </label>
          <div className="relative">
            <i className="ri-lock-password-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
            <input
              id="mdp-nouveau"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={nouveau}
              onChange={(e) => setNouveau(e.target.value)}
              placeholder="8 caractères, majuscule, chiffre, spécial"
              className={champCls}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              title={show ? "Masquer" : "Afficher"}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md text-foreground-400 hover:text-foreground-700 cursor-pointer"
            >
              <i className={show ? "ri-eye-off-line" : "ri-eye-line"}></i>
            </button>
          </div>
          <IndicateurForceMotDePasse valeur={nouveau} seuilLongueur={8} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="mdp-confirm" className="text-xs font-semibold text-foreground-700">
            Confirmez le nouveau mot de passe
          </label>
          <div className="relative">
            <i className="ri-lock-2-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
            <input
              id="mdp-confirm"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Retapez le nouveau mot de passe"
              className={champCls}
            />
          </div>
          <IndicateurCorrespondanceMdp motDePasse={nouveau} confirmation={confirm} />
        </div>

        <div className="flex flex-wrap justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center h-10 px-4 rounded-md text-sm font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
            Enregistrer le mot de passe
          </button>
        </div>
      </form>
    </Modal>
  );
}