import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useRobotsMeta } from "@/hooks/useRobotsMeta";
import { supabase } from "@/lib/supabase";
import { historiserChangementMotDePasse, mettreAJourMotDePasse, validerMotDePasseFort } from "@/lib/motDePasse";
import { translateAuthError } from "@/pages/app/auth/errors";
import AuthBrandPanel from "@/pages/app/auth/components/AuthBrandPanel";
import RenvoyerLienReset from "@/pages/app/auth/components/RenvoyerLienReset";
import IndicateurCorrespondanceMdp from "@/pages/app/auth/components/IndicateurCorrespondanceMdp";
import { Feedback, Field, inputIconClass } from "@/pages/app/auth/components/FormBits";
import IndicateurForceMotDePasse from "@/components/base/IndicateurForceMotDePasse";

type Etat = "verif" | "form" | "invalide" | "succes";

/**
 * Page de réinitialisation de mot de passe : ouverte via le lien reçu par email.
 * Le Backend y ouvre une session « récupération » ; l'utilisateur définit alors
 * son nouveau mot de passe.
 */
export default function ResetPasswordPage() {
  useRobotsMeta("noindex, nofollow");
  const navigate = useNavigate();

  const [etat, setEtat] = useState<Etat>("verif");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let resolved = false;

    // Affiche le formulaire et mémorise l'adresse concernée (rassurer l'utilisateur sur
    // le compte en cours de réinitialisation). Récupération asynchrone, sans bloquer.
    const afficherFormulaire = (session: { user?: { email?: string | null } } | null) => {
      resolved = true;
      setEtat("form");
      if (session?.user?.email) setEmail(session.user.email);
      supabase.auth
        .getUser()
        .then(({ data }) => {
          if (active && data.user?.email) setEmail(data.user.email);
        })
        .catch(() => {
          /* l'adresse n'est qu'un confort d'affichage */
        });
    };

    // Le lien de récupération ouvre une session : on l'écoute. On retombe aussi sur la
    // session déjà ouverte (le Backend traite le jeton du lien au chargement de l'app).
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        afficherFormulaire(session);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active || resolved) return;
        if (data.session) afficherFormulaire(data.session);
      })
      .catch(() => {
        /* on tranche via le délai ci-dessous */
      })
      .finally(() => {
        // Laisse le temps au jeton du lien d'être traité avant de conclure à un lien invalide.
        setTimeout(() => {
          if (active && !resolved) setEtat("invalide");
        }, 2000);
      });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const erreurForce = validerMotDePasseFort(password);
    if (erreurForce) {
      setError(erreurForce);
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      await mettreAJourMotDePasse(password);
      // Garde une trace du changement dans l'historique du profil.
      try {
        const { data } = await supabase.auth.getUser();
        if (data.user) await historiserChangementMotDePasse(data.user.id);
      } catch {
        /* l'historique n'empêche pas la réinitialisation */
      }
      setEtat("succes");
    } catch (e) {
      setError(translateAuthError(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background-50">
      <AuthBrandPanel />

      <div className="flex-1 flex flex-col">
        <div className="lg:hidden flex items-center justify-between px-4 md:px-6 h-16 border-b border-background-200">
          <Link to="/" className="flex items-center gap-2.5 cursor-pointer">
            <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-500 text-background-50">
              <i className="ri-tools-fill text-lg"></i>
            </span>
            <span className="font-heading font-bold text-lg text-foreground-950">ArtiFlow-pro</span>
          </Link>
          {!Capacitor.isNativePlatform() && (
            <Link to="/" className="text-xs font-medium text-foreground-500 hover:text-foreground-900 cursor-pointer">
              Retour au site
            </Link>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center px-4 py-10 md:py-14">
          <div className="w-full max-w-md">
            <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 text-center">
              Nouveau mot de passe
            </h1>
            <p className="mt-2 text-sm text-foreground-500 text-center">
              Choisissez un nouveau mot de passe pour sécuriser votre espace.
            </p>

            <div className="mt-6">
              {etat === "verif" && (
                <div className="flex flex-col items-center text-center gap-3 py-6">
                  <span className="w-12 h-12 flex items-center justify-center rounded-full bg-primary-100 text-primary-700">
                    <i className="ri-loader-4-line animate-spin text-xl"></i>
                  </span>
                  <p className="text-sm text-foreground-500">Vérification de votre lien…</p>
                </div>
              )}

              {etat === "invalide" && (
                <div className="flex flex-col items-center text-center gap-4 py-2">
                  <span className="w-14 h-14 flex items-center justify-center rounded-full bg-red-50 text-red-600">
                    <i className="ri-link-unlink-m text-2xl"></i>
                  </span>
                  <div>
                    <p className="font-heading font-semibold text-lg text-foreground-950">
                      Lien invalide ou expiré
                    </p>
                    <p className="mt-2 text-sm text-foreground-500 leading-relaxed">
                      Ce lien de réinitialisation n'est plus valable. Demandez-en un nouveau juste en
                      dessous pour définir votre mot de passe.
                    </p>
                  </div>
                  <div className="w-full text-left">
                    <RenvoyerLienReset />
                  </div>
                  <Link
                    to="/app/auth"
                    className="text-xs font-medium text-foreground-500 hover:text-primary-700 cursor-pointer"
                  >
                    Revenir à la connexion
                  </Link>
                </div>
              )}

              {etat === "form" && (
                <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
                  {email && (
                    <div className="flex items-start gap-2 rounded-md bg-background-100 border border-background-200 px-3 py-2.5">
                      <i className="ri-mail-line mt-0.5 shrink-0 text-primary-600"></i>
                      <p className="text-xs text-foreground-600 leading-relaxed">
                        Réinitialisation du mot de passe pour{" "}
                        <strong className="text-foreground-800 break-all">{email}</strong>.
                      </p>
                    </div>
                  )}

                  {error && <Feedback kind="error" text={error} />}

                  <Field label="Nouveau mot de passe" htmlFor="reset-password">
                    <div className="relative">
                      <i className="ri-lock-2-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
                      <input
                        id="reset-password"
                        type={show ? "text" : "password"}
                        name="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="8 caractères, majuscule, chiffre, spécial"
                        className={`${inputIconClass} pr-10`}
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
                  </Field>
                  <IndicateurForceMotDePasse valeur={password} seuilLongueur={8} />

                  <Field label="Confirmez le mot de passe" htmlFor="reset-confirm">
                    <div className="relative">
                      <i className="ri-lock-2-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
                      <input
                        id="reset-confirm"
                        type={show ? "text" : "password"}
                        name="confirm"
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Retapez le mot de passe"
                        className={inputIconClass}
                      />
                    </div>
                  </Field>
                  <IndicateurCorrespondanceMdp motDePasse={password} confirmation={confirm} />

                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-1 inline-flex items-center justify-center gap-2 h-11 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-lock-password-line"></i>}
                    Enregistrer le nouveau mot de passe
                  </button>
                </form>
              )}

              {etat === "succes" && (
                <div className="flex flex-col items-center text-center gap-4 py-4">
                  <span className="w-14 h-14 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
                    <i className="ri-shield-check-line text-2xl"></i>
                  </span>
                  <div>
                    <p className="font-heading font-semibold text-lg text-foreground-950">Mot de passe modifié</p>
                    <p className="mt-2 text-sm text-foreground-500 leading-relaxed">
                      Votre nouveau mot de passe est actif. Vous pouvez dès à présent accéder à votre espace.
                    </p>
                  </div>
                  <div className="w-full rounded-lg border border-background-200 bg-background-100 px-4 py-3.5 text-left">
                    <p className="flex items-center gap-2 text-xs font-semibold text-foreground-800">
                      <span className="w-4 h-4 flex items-center justify-center text-secondary-600">
                        <i className="ri-shield-keyhole-line"></i>
                      </span>
                      Bonnes pratiques de sécurité
                    </p>
                    <ul className="mt-2.5 flex flex-col gap-2">
                      <li className="flex items-start gap-2 text-xs text-foreground-600 leading-relaxed">
                        <span className="w-4 h-4 mt-px flex items-center justify-center shrink-0 text-accent-600">
                          <i className="ri-checkbox-circle-line"></i>
                        </span>
                        Au moins <strong className="font-semibold text-foreground-800">8 caractères</strong>, avec majuscules, minuscules, chiffres et un caractère spécial.
                      </li>
                      <li className="flex items-start gap-2 text-xs text-foreground-600 leading-relaxed">
                        <span className="w-4 h-4 mt-px flex items-center justify-center shrink-0 text-accent-600">
                          <i className="ri-checkbox-circle-line"></i>
                        </span>
                        Un mot de passe <strong className="font-semibold text-foreground-800">unique</strong>, jamais réutilisé sur un autre site.
                      </li>
                      <li className="flex items-start gap-2 text-xs text-foreground-600 leading-relaxed">
                        <span className="w-4 h-4 mt-px flex items-center justify-center shrink-0 text-accent-600">
                          <i className="ri-checkbox-circle-line"></i>
                        </span>
                        Ne le partagez avec personne et évitez les informations trop personnelles.
                      </li>
                    </ul>
                    <Link
                      to="/guide/mot-de-passe-solide"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800 cursor-pointer"
                    >
                      <i className="ri-book-open-line"></i>
                      Lire le guide « Créer un mot de passe solide »
                      <i className="ri-arrow-right-line"></i>
                    </Link>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/app", { replace: true })}
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                  >
                    <i className="ri-arrow-right-line"></i>
                    Accéder à mon espace
                  </button>
                </div>
              )}
            </div>

            {etat !== "succes" && (
              <p className="mt-6 text-xs text-foreground-400 text-center leading-relaxed">
                Vous vous souvenez de votre mot de passe ?{" "}
                <Link to="/app/auth" className="text-primary-700 hover:text-primary-800 cursor-pointer">
                  Revenir à la connexion
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}