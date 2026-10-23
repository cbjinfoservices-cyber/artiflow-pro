import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { demanderReinitialisationMotDePasse, verifierCodeRecuperation } from "@/lib/motDePasse";
import { ajouterLienAuthTest } from "@/lib/liensAuthTestsMemoire";
import { translateAuthError } from "@/pages/app/auth/errors";
import { Feedback, Field, inputClass } from "@/pages/app/auth/components/FormBits";

/** Délai (en secondes) avant de pouvoir demander un nouveau code. */
const DELAI_RENVOI = 60;

interface Props {
  /** Adresse email concernée par la réinitialisation (celle qui a reçu le code). */
  email: string;
}

/**
 * Saisie du code à 6 chiffres reçu par email. L'email de réinitialisation contient à la
 * fois un lien et un code : ce formulaire couvre le cas où l'utilisateur préfère recopier
 * le code plutôt que de cliquer le lien. Une fois le code vérifié, le Backend ouvre une
 * session « récupération » et l'utilisateur est redirigé vers l'écran de définition du
 * nouveau mot de passe. Un compte à rebours limite les demandes de renvoi en rafale.
 */
export default function CodeRecuperationForm({ email }: Props) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renvoiOk, setRenvoiOk] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const propre = code.replace(/\D/g, "").slice(0, 6);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setRenvoiOk(false);
    if (propre.length !== 6) {
      setError("Saisissez le code à 6 chiffres reçu par email.");
      return;
    }
    setBusy(true);
    try {
      await verifierCodeRecuperation(email, propre);
      // Le code est validé : une session « récupération » est ouverte, l'écran de
      // définition du nouveau mot de passe s'affiche.
      navigate("/app/auth/reset-password", { replace: true });
    } catch (e) {
      setError(translateAuthError(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  };

  const onRenvoyer = async () => {
    if (busy || cooldown > 0) return;
    setError(null);
    setRenvoiOk(false);
    setBusy(true);
    try {
      await demanderReinitialisationMotDePasse(email);
      ajouterLienAuthTest("reset", email);
      setRenvoiOk(true);
      setCooldown(DELAI_RENVOI);
    } catch (e) {
      setError(translateAuthError(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      {error && <Feedback kind="error" text={error} />}
      {renvoiOk && <Feedback kind="success" text={`Un nouveau code a été envoyé à ${email}.`} />}

      <Field label="Code à 6 chiffres" htmlFor="reset-code">
        <input
          id="reset-code"
          type="text"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={propre}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="••••••"
          className={`${inputClass} text-center text-xl font-semibold tracking-[0.4em]`}
        />
      </Field>

      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 h-11 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-shield-keyhole-line"></i>}
        Valider le code
      </button>

      <button
        type="button"
        onClick={onRenvoyer}
        disabled={busy || cooldown > 0}
        className="self-center text-xs font-medium text-foreground-500 hover:text-primary-700 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {cooldown > 0 ? `Recevoir un nouveau code dans ${cooldown} s` : "Recevoir un nouveau code"}
      </button>
    </form>
  );
}