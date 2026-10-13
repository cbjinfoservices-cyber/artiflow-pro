import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { demanderReinitialisationMotDePasse } from "@/lib/motDePasse";
import { ajouterLienAuthTest } from "@/lib/liensAuthTestsMemoire";
import { translateAuthError } from "@/pages/app/auth/errors";
import { Feedback, Field, inputIconClass } from "@/pages/app/auth/components/FormBits";

/** Délai (en secondes) avant de pouvoir demander un nouveau lien. */
const DELAI_RENVOI = 60;

interface Props {
  /** Adresse proposée par défaut lorsque l'application la connaît. */
  emailInitial?: string;
}

/**
 * Petit panneau « Renvoyer un lien » : permet de demander un nouvel email de
 * réinitialisation sans repasser par la page de connexion, notamment depuis
 * l'écran « Lien invalide ou expiré ». Un compte à rebours limite les renvois.
 */
export default function RenvoyerLienReset({ emailInitial = "" }: Props) {
  const [email, setEmail] = useState(emailInitial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);
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
      ajouterLienAuthTest("reset", adresse);
      setEnvoye(true);
      setCooldown(DELAI_RENVOI);
    } catch (e) {
      setError(translateAuthError(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  };

  if (envoye) {
    return (
      <div className="flex flex-col items-center text-center gap-3">
        <span className="w-12 h-12 flex items-center justify-center rounded-full bg-primary-100 text-primary-700">
          <i className="ri-mail-check-line text-xl"></i>
        </span>
        <p className="text-sm text-foreground-600 leading-relaxed">
          Un nouveau lien a été envoyé à{" "}
          <strong className="text-foreground-800 break-all">{email}</strong>. Pensez à regarder vos{" "}
          <strong className="text-foreground-800">spams / indésirables</strong> (expéditeur ArtiFlow-pro).
        </p>
        {cooldown > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground-400">
            <i className="ri-time-line"></i>
            Nouvel envoi possible dans {cooldown} s
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setEnvoye(false)}
            className="text-xs font-medium text-foreground-500 hover:text-primary-700 cursor-pointer"
          >
            Renvoyer à une autre adresse
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full flex flex-col gap-3" noValidate>
      {error && <Feedback kind="error" text={error} />}

      <Field label="Adresse email" htmlFor="reset-resend-email">
        <div className="relative">
          <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
          <input
            id="reset-resend-email"
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
        className="inline-flex items-center justify-center gap-2 h-11 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? (
          <i className="ri-loader-4-line animate-spin"></i>
        ) : cooldown > 0 ? (
          <i className="ri-time-line"></i>
        ) : (
          <i className="ri-mail-send-line"></i>
        )}
        {cooldown > 0 ? `Réessayez dans ${cooldown} s` : "Renvoyer un lien"}
      </button>
    </form>
  );
}