import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useRobotsMeta } from "@/hooks/useRobotsMeta";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { normalizeChantierStatut } from "@/lib/statuts";
import { formatEuros } from "@/lib/format";
import { chargerEspaceClient, type ChantierEspaceClient } from "@/lib/suiviChantier";

const TONS: Record<string, string> = {
  "En cours": "bg-primary-100 text-primary-800",
  Terminé: "bg-accent-100 text-accent-800",
  Planifié: "bg-secondary-100 text-secondary-800",
};

function dateCourte(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Espace client : le particulier retrouve tous les chantiers dont le suivi lui est partagé. */
export default function EspaceClientPage() {
  usePageMeta(
    "Mes chantiers · ArtiFlow-pro",
    "Retrouvez en un seul endroit le suivi de tous vos chantiers et l'avancement des travaux.",
  );
  useRobotsMeta("noindex, nofollow");

  const { session, loading: authLoading, signIn, signOut } = useAuth();
  const [mode, setMode] = useState<"connexion" | "inscription">("connexion");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [chantiers, setChantiers] = useState<ChantierEspaceClient[] | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);

  const connecte = Boolean(session?.user);

  const charger = useCallback(async () => {
    if (!session?.user) {
      setChantiers(null);
      return;
    }
    setChargement(true);
    setErreurChargement(null);
    try {
      const liste = await chargerEspaceClient();
      setChantiers(liste);
    } catch (e) {
      setErreurChargement(e instanceof Error ? e.message : "Impossible de charger vos chantiers.");
      setChantiers([]);
    } finally {
      setChargement(false);
    }
  }, [session]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const soumettre = async (evenement: FormEvent<HTMLFormElement>) => {
    evenement.preventDefault();
    setErreur(null);
    setInfo(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErreur("Saisissez une adresse email valide.");
      return;
    }
    if (motDePasse.length < 6) {
      setErreur("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "connexion") {
        const resultat = await signIn(email.trim(), motDePasse);
        if (resultat.error) setErreur("Connexion impossible : vérifiez votre email et votre mot de passe.");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: motDePasse,
        });
        if (error) {
          setErreur(
            error.message.includes("already")
              ? "Un compte existe déjà avec cette adresse. Connectez-vous."
              : "L'inscription a échoué. Réessayez dans un instant.",
          );
        } else if (!data.session) {
          setInfo("Compte créé. Vérifiez votre boîte mail et cliquez sur le lien de confirmation pour vous connecter.");
          setMode("connexion");
        }
      }
    } catch {
      setErreur("Une erreur est survenue. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-50 flex flex-col">
      <header className="h-16 shrink-0 flex items-center justify-between px-4 md:px-6 border-b border-background-200">
        <Link to="/" className="flex items-center gap-2.5 cursor-pointer">
          <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-500 text-background-50">
            <i className="ri-tools-fill text-base"></i>
          </span>
          <span className="font-heading font-bold text-base text-foreground-950">ArtiFlow-pro</span>
        </Link>
        <Link
          to="/app/auth"
          className="text-xs font-semibold text-foreground-600 hover:text-primary-700 whitespace-nowrap cursor-pointer"
        >
          Je suis un artisan
        </Link>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="mb-6">
          <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Espace client</p>
          <h1 className="mt-1 font-heading font-bold text-2xl md:text-3xl text-foreground-950">Mes chantiers</h1>
          <p className="mt-2 text-sm text-foreground-600 max-w-xl">
            Retrouvez ici le suivi de tous les chantiers que votre artisan partage avec vous. Pas de compte à créer
            pour un coup d'œil rapide : le lien reçu par email fonctionne directement.
          </p>
        </div>

        {authLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-foreground-500">
            <i className="ri-loader-4-line animate-spin"></i>
            Chargement…
          </div>
        ) : !connecte ? (
          <div className="p-5 md:p-6 rounded-lg bg-background-100 border border-background-200 max-w-md">
            <div className="flex items-center gap-1 p-1 rounded-full bg-background-200/70 border border-background-200 w-fit mb-5">
              <button
                type="button"
                onClick={() => {
                  setMode("connexion");
                  setErreur(null);
                  setInfo(null);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  mode === "connexion" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-100"
                }`}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("inscription");
                  setErreur(null);
                  setInfo(null);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  mode === "inscription" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-100"
                }`}
              >
                Créer un compte
              </button>
            </div>

            <form onSubmit={soumettre} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-medium text-foreground-700">Adresse email</span>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="vous@exemple.fr"
                  className="w-full box-border h-11 px-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-900 outline-none focus:ring-2 focus:ring-primary-300"
                />
              </label>
              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-medium text-foreground-700">Mot de passe</span>
                <input
                  type="password"
                  name="password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  autoComplete={mode === "connexion" ? "current-password" : "new-password"}
                  placeholder="Au moins 6 caractères"
                  className="w-full box-border h-11 px-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-900 outline-none focus:ring-2 focus:ring-primary-300"
                />
              </label>

              {erreur && (
                <p className="text-xs text-red-600 flex items-start gap-1.5">
                  <i className="ri-error-warning-line mt-0.5"></i>
                  <span>{erreur}</span>
                </p>
              )}
              {info && (
                <p className="text-xs text-accent-700 flex items-start gap-1.5">
                  <i className="ri-checkbox-circle-line mt-0.5"></i>
                  <span>{info}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-1 inline-flex items-center justify-center gap-2 h-11 px-5 w-full rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-login-box-line"></i>}
                {mode === "connexion" ? "Se connecter" : "Créer mon compte"}
              </button>
            </form>

            <p className="mt-4 text-[11px] text-foreground-500 leading-relaxed">
              Utilisez l'adresse email que votre artisan a enregistrée dans votre fiche : c'est elle qui relie votre
              compte à vos chantiers.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 flex-wrap p-4 rounded-lg bg-background-100 border border-background-200">
              <div className="min-w-0">
                <p className="text-xs text-foreground-500">Connecté en tant que</p>
                <p className="text-sm font-semibold text-foreground-950 truncate">{session?.user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void signOut();
                }}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-background-50 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
              >
                <i className="ri-logout-box-line"></i>
                Se déconnecter
              </button>
            </div>

            {chargement && (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-foreground-500">
                <i className="ri-loader-4-line animate-spin"></i>
                Chargement de vos chantiers…
              </div>
            )}

            {!chargement && erreurChargement && (
              <div className="p-6 rounded-lg bg-background-100 border border-background-200 text-center">
                <p className="text-sm text-foreground-700">{erreurChargement}</p>
                <button
                  type="button"
                  onClick={() => {
                    void charger();
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-refresh-line"></i>
                  Réessayer
                </button>
              </div>
            )}

            {!chargement && !erreurChargement && chantiers && chantiers.length === 0 && (
              <div className="p-8 rounded-lg bg-background-100 border border-background-200 text-center">
                <span className="inline-flex w-14 h-14 items-center justify-center rounded-full bg-secondary-100 text-secondary-700 text-2xl">
                  <i className="ri-building-2-line"></i>
                </span>
                <p className="mt-3 font-heading font-semibold text-foreground-950">Aucun chantier partagé pour l'instant</p>
                <p className="mt-1 text-sm text-foreground-500 max-w-md mx-auto">
                  Demandez à votre artisan de partager le suivi : il vous suffira ensuite d'ouvrir le lien reçu par email
                  ou de revenir sur cette page.
                </p>
              </div>
            )}

            {!chargement &&
              !erreurChargement &&
              chantiers &&
              chantiers.map((c) => {
                const statut = normalizeChantierStatut(c.statut);
                return (
                  <article key={c.id} className="p-5 rounded-lg bg-background-100 border border-background-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-heading font-semibold text-base text-foreground-950 truncate">{c.libelle}</h2>
                        <p className="text-xs text-foreground-500 mt-0.5 inline-flex items-center gap-1">
                          <i className="ri-map-pin-line"></i>
                          {c.adresse ?? "Adresse à préciser"}
                        </p>
                        <p className="text-xs text-foreground-500 mt-0.5 inline-flex items-center gap-1">
                          <i className="ri-user-star-line"></i>
                          {c.artisanNom}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                          TONS[statut] ?? TONS.Planifié
                        }`}
                      >
                        {statut}
                      </span>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-foreground-500">
                          Avancement ({c.etapesFaites}/{c.etapesTotal} étapes)
                        </span>
                        <span className="font-semibold text-foreground-900">{c.progression} %</span>
                      </div>
                      <div className="h-2 rounded-full bg-background-200 overflow-hidden">
                        <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${c.progression}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
                      <span className="text-xs text-foreground-500 inline-flex items-center gap-1">
                        <i className="ri-history-line"></i>
                        Mis à jour le {dateCourte(c.majLe)}
                        <span className="text-foreground-300">·</span>
                        {formatEuros(c.montant)}
                      </span>
                      {c.token ? (
                        <Link
                          to={`/suivi/${c.token}`}
                          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                        >
                          Voir le suivi
                          <i className="ri-arrow-right-line"></i>
                        </Link>
                      ) : (
                        <span className="text-xs text-foreground-400">Lien non disponible</span>
                      )}
                    </div>
                  </article>
                );
              })}
          </div>
        )}
      </main>

      <footer className="shrink-0 border-t border-background-200 px-4 md:px-6 py-6 text-center">
        <p className="text-xs text-foreground-400">Suivi de chantier propulsé par ArtiFlow-pro.</p>
      </footer>
    </div>
  );
}