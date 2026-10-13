import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { translateAuthError } from "@/pages/app/auth/errors";
import { Feedback, Field, inputClass, inputIconClass } from "@/pages/app/auth/components/FormBits";
import IndicateurForceMotDePasse from "@/components/base/IndicateurForceMotDePasse";
import { validerMotDePasseFort } from "@/lib/motDePasse";
import { METIERS } from "@/lib/metiers";

export default function SignUpForm({ onDone }: { onDone: () => void }) {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/app";

  const [entreprise, setEntreprise] = useState("");
  const [metier, setMetier] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!entreprise.trim() || !metier || !email.trim() || !password) {
      setError("Complétez les champs obligatoires : entreprise, métier, email et mot de passe.");
      return;
    }
    const erreurMdp = validerMotDePasseFort(password);
    if (erreurMdp) {
      setError(erreurMdp);
      return;
    }
    setBusy(true);
    const { error: err, needsConfirmation } = await signUp({
      email: email.trim(),
      password,
      metier,
      entreprise: entreprise.trim(),
      telephone: telephone.trim(),
    });
    setBusy(false);
    if (err) {
      setError(translateAuthError(err));
      return;
    }
    if (needsConfirmation) {
      setDone(true);
      return;
    }
    navigate(from, { replace: true });
  };

  if (done) {
    return (
      <div className="flex flex-col items-center text-center gap-4 py-4">
        <span className="w-14 h-14 flex items-center justify-center rounded-full bg-primary-100 text-primary-700">
          <i className="ri-mail-check-line text-2xl"></i>
        </span>
        <div>
          <p className="font-heading font-semibold text-lg text-foreground-950">Vérifiez votre boîte mail</p>
          <p className="mt-2 text-sm text-foreground-500 leading-relaxed">
            Nous avons envoyé un lien de confirmation à{" "}
            <strong className="text-foreground-800">{email}</strong>. Cliquez dessus pour activer votre espace.
          </p>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-md border border-background-200 text-sm font-semibold text-foreground-800 cursor-pointer hover:bg-background-100 transition-colors"
        >
          <i className="ri-arrow-left-line"></i>
          Retour à la connexion
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Feedback kind="error" text={error} />}

      <Field label="Nom de l'entreprise *" htmlFor="signup-entreprise">
        <input
          id="signup-entreprise"
          type="text"
          name="entreprise"
          value={entreprise}
          onChange={(e) => setEntreprise(e.target.value)}
          placeholder="Plomberie Benali"
          className={inputClass}
        />
      </Field>

      <Field label="Métier *" htmlFor="signup-metier">
        <select
          id="signup-metier"
          name="metier"
          value={metier}
          onChange={(e) => setMetier(e.target.value)}
          className={`${inputClass} cursor-pointer`}
        >
          <option value="">Sélectionnez votre métier</option>
          {METIERS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Téléphone" htmlFor="signup-telephone">
        <input
          id="signup-telephone"
          type="tel"
          name="telephone"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          placeholder="06 12 34 56 78"
          className={inputClass}
        />
      </Field>

      <Field label="Adresse email *" htmlFor="signup-email">
        <div className="relative">
          <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
          <input
            id="signup-email"
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

      <Field label="Mot de passe *" htmlFor="signup-password">
        <div className="relative">
          <i className="ri-lock-2-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
          <input
            id="signup-password"
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8 caractères, majuscule, chiffre, spécial"
            className={`${inputIconClass} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            title={showPassword ? "Masquer" : "Afficher"}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md text-foreground-400 hover:text-foreground-700 cursor-pointer"
          >
            <i className={showPassword ? "ri-eye-off-line" : "ri-eye-line"}></i>
          </button>
        </div>
        <IndicateurForceMotDePasse valeur={password} seuilLongueur={8} />
      </Field>

      <button
        type="submit"
        disabled={busy}
        className="mt-1 inline-flex items-center justify-center gap-2 h-11 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-user-add-line"></i>}
        Créer mon espace
      </button>
    </form>
  );
}