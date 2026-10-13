import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { translateAuthError } from "@/pages/app/auth/errors";
import { Feedback, Field, inputIconClass } from "@/pages/app/auth/components/FormBits";

export default function LoginForm({ onForgot }: { onForgot?: () => void }) {
  const { signIn, sendMagicLink } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError("Renseignez votre email et votre mot de passe.");
      return;
    }
    setBusy(true);
    const { error: err } = await signIn(email.trim(), password);
    setBusy(false);
    if (err) {
      setError(translateAuthError(err));
      return;
    }
    navigate(from, { replace: true });
  };

  const onMagicLink = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError("Renseignez votre email pour recevoir le lien de connexion.");
      return;
    }
    setBusy(true);
    const { error: err, info: ok } = await sendMagicLink(email.trim());
    setBusy(false);
    if (err) {
      setError(translateAuthError(err));
      return;
    }
    setInfo(ok ?? "Lien de connexion envoyé !");
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Feedback kind="error" text={error} />}
      {info && <Feedback kind="success" text={info} />}

      <Field label="Adresse email" htmlFor="login-email">
        <div className="relative">
          <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
          <input
            id="login-email"
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

      <Field label="Mot de passe" htmlFor="login-password">
        <div className="relative">
          <i className="ri-lock-2-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Votre mot de passe"
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
      </Field>

      <button
        type="submit"
        disabled={busy}
        className="mt-1 inline-flex items-center justify-center gap-2 h-11 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-login-box-line"></i>}
        Se connecter
      </button>

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-background-200"></span>
        <span className="text-[11px] uppercase tracking-wide text-foreground-400">ou</span>
        <span className="h-px flex-1 bg-background-200"></span>
      </div>

      <button
        type="button"
        onClick={onMagicLink}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 h-11 rounded-md border border-background-200 bg-background-50 text-sm font-semibold text-foreground-800 whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <i className="ri-magic-line"></i>
        Recevoir un lien de connexion par email
      </button>

      <p className="flex items-start gap-1.5 text-[11px] text-foreground-500 leading-relaxed px-1">
        <i className="ri-information-line mt-0.5 shrink-0 text-foreground-400"></i>
        <span>
          Le lien reçu par email vous connecte directement, sans mot de passe. S'il n'arrive pas
          dans les minutes qui suivent, pensez à regarder dans vos{" "}
          <strong className="font-semibold text-foreground-700">spams</strong> (l'expéditeur est
          ArtiFlow-pro) et vérifiez l'orthographe de l'adresse saisie.
        </span>
      </p>

      {onForgot && (
        <button
          type="button"
          onClick={onForgot}
          className="self-center text-xs font-medium text-foreground-500 hover:text-primary-700 cursor-pointer"
        >
          Mot de passe oublié ?
        </button>
      )}
    </form>
  );
}