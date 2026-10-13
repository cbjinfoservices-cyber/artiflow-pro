import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useRobotsMeta } from "@/hooks/useRobotsMeta";
import { useAuth } from "@/hooks/useAuth";
import AuthBrandPanel from "@/pages/app/auth/components/AuthBrandPanel";
import LoginForm from "@/pages/app/auth/components/LoginForm";
import SignUpForm from "@/pages/app/auth/components/SignUpForm";
import ForgotPasswordForm from "@/pages/app/auth/components/ForgotPasswordForm";

export default function AuthPage() {
  useRobotsMeta("noindex, nofollow");
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");

  if (!loading && session) {
    return <Navigate to="/app" replace />;
  }

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
          <Link to="/" className="text-xs font-medium text-foreground-500 hover:text-foreground-900 cursor-pointer">
            Retour au site
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-4 py-10 md:py-14">
          <div className="w-full max-w-md">
            <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 text-center">
              {mode === "login" ? "Content de vous revoir" : mode === "signup" ? "Créez votre espace" : "Mot de passe oublié"}
            </h1>
            <p className="mt-2 text-sm text-foreground-500 text-center">
              {mode === "login"
                ? "Connectez-vous pour retrouver vos devis et vos chantiers."
                : mode === "signup"
                  ? "Quelques informations et c'est parti, gratuitement."
                  : "Recevez un lien par email pour définir un nouveau mot de passe."}
            </p>

            <div className="mt-6 flex p-1 rounded-full bg-background-100 border border-background-200">
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 h-9 rounded-full text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    mode === m
                      ? "bg-background-50 text-foreground-950 border border-background-200"
                      : "text-foreground-500 hover:text-foreground-800"
                  }`}
                >
                  {m === "login" ? "Connexion" : "Inscription"}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {mode === "login" && <LoginForm onForgot={() => setMode("forgot")} />}
              {mode === "signup" && <SignUpForm onDone={() => setMode("login")} />}
              {mode === "forgot" && <ForgotPasswordForm onBack={() => setMode("login")} />}
            </div>

            <p className="mt-6 text-xs text-foreground-400 text-center leading-relaxed">
              En continuant, vous acceptez nos{" "}
              <Link to="/cgv" className="text-primary-700 hover:text-primary-800 cursor-pointer">
                conditions générales
              </Link>{" "}
              et notre{" "}
              <Link to="/rgpd" className="text-primary-700 hover:text-primary-800 cursor-pointer">
                politique de données
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}