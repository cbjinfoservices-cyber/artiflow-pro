import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { demanderReinitialisationMotDePasse } from "@/lib/motDePasse";
import { ajouterLienAuthTest } from "@/lib/liensAuthTestsMemoire";
import { translateAuthError } from "@/pages/app/auth/errors";
import { Feedback, Field, inputIconClass } from "@/pages/app/auth/components/FormBits";

/** Délai (en secondes) avant de pouvoir renvoyer un email de réinitialisation. */
const DELAI_RENVOI = 60;

interface Props {
  /** Revient à l'écran de connexion. */
  onBack: () => void;
}

/**
 * Formulaire « Mot de passe oublié » : l'utilisateur saisit son adresse email et reçoit
 * un lien pour définir un nouveau mot de passe (flux géré par l'authentification du Backend).
 * Un compte à rebours limite les renvois en rafale.
 */
export default function ForgotPasswordForm({ onBack }: Props) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const valide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (cooldown > 0) return;
    if (!valide) {
      setError("Renseignez une adresse email valide.");
      return;
    }
    setBusy(true);
    try {
      const adresse = email.trim();
      await demanderReinitialisationMotDePasse(adresse);
      // Trace la demande dans l'historique des liens d'authentification du Diagnostic,
      // pour que la demande RÉELLE apparaisse aux côtés des tests (premier essai, suivi).
      ajouterLienAuthTest("reset", adresse);
      setSent(true);
      setCooldown(DELAI_RENVOI);
    } catch (e) {
      setError(translateAuthError(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-4">
        <span className="w-14 h-14 flex items-center justify-center rounded-full bg-primary-100 text-primary-700">
          <i className="ri-mail-check-line text-2xl"></i>
        </span>
        <div>
          <p className="font-heading font-semibold text-lg text-foreground-950">Vérifiez votre boîte mail</p>
          <p className="mt-2 text-sm text-foreground-500 leading-relaxed">
            Si un compte existe pour <strong className="text-foreground-800">{email}</strong>, vous recevrez un
            email avec un lien pour définir un nouveau mot de passe. Le lien peut mettre quelques minutes à arriver ;
            s'il tarde, pensez à regarder vos{" "}
            <strong className="text-foreground-800">spams / indésirables</strong> (l'expéditeur est ArtiFlow-pro).
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-md border border-background-200 text-sm font-semibold text-foreground-800 cursor-pointer hover:bg-background-100 transition-colors"
        >
          <i className="ri-arrow-left-line"></i>
          Retour à la connexion
        </button>
        {cooldown > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground-400">
            <i className="ri-time-line"></i>
            Nouvel envoi possible dans {cooldown} s
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setSent(false)}
            className="text-xs font-medium text-foreground-500 hover:text-primary-700 cursor-pointer"
          >
            Renvoyer un email à une autre adresse
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Feedback kind="error" text={error} />}

      <Field label="Adresse email" htmlFor="forgot-email">
        <div className="relative">
          <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
          <input
            id="forgot-email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.fr"
            className={inputIconClass}
          />
        </div>
      </Field>

      <button
        type="submit"
        disabled={busy || cooldown > 0}
        className="mt-1 inline-flex items-center justify-center gap-2 h-11 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? (
          <i className="ri-loader-4-line animate-spin"></i>
        ) : cooldown > 0 ? (
          <i className="ri-time-line"></i>
        ) : (
          <i className="ri-mail-send-line"></i>
        )}
        {cooldown > 0 ? `Réessayez dans ${cooldown} s` : "Envoyer le lien de réinitialisation"}
      </button>

      <div className="flex items-start gap-2 rounded-md bg-background-100 border border-background-200 px-3 py-2.5">
        <i className="ri-information-line mt-0.5 shrink-0 text-primary-600"></i>
        <div className="text-xs text-foreground-600 leading-relaxed">
          <p>
            Pensez à regarder vos <strong className="font-semibold text-foreground-800">spams / indésirables</strong> :
            le lien peut y tomber. Il peut aussi mettre quelques minutes à arriver. L'expéditeur est
            ArtiFlow-pro ; vérifiez également l'orthographe de l'adresse saisie.
          </p>
          <Link
            to="/guide/mot-de-passe-solide"
            className="mt-2 inline-flex items-center gap-1.5 font-semibold text-primary-700 hover:text-primary-800 cursor-pointer"
          >
            <i className="ri-book-open-line"></i>
            Comment créer un mot de passe solide ?
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center justify-center gap-2 h-10 rounded-md text-sm font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:text-foreground-900 transition-colors"
      >
        <i className="ri-arrow-left-line"></i>
        Retour à la connexion
      </button>
    </form>
  );
}