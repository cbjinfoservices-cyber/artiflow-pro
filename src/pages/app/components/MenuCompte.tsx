import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStatutEnvoiEmails } from "@/hooks/useStatutEnvoiEmails";
import { envoyerEmailTest } from "@/lib/diagnosticEmail";
import ChangerMotDePasseModal from "@/components/feature/ChangerMotDePasseModal";
import SauvegardeDonneesModal from "@/pages/app/components/SauvegardeDonneesModal";

/**
 * Menu du compte affiché en haut à droite de l'en-tête de l'espace.
 * Il regroupe l'accès au profil, le changement de mot de passe et la déconnexion,
 * pour un accès rapide sans passer par le bas du menu latéral.
 */
export default function MenuCompte({ backOfficeOnly }: { backOfficeOnly: boolean }) {
  const { user, profile, signOut, isGestionnaire, isGestionnairePrincipal } = useAuth();
  // État de la config d'envoi des emails : sert au petit badge d'alerte du menu.
  const { alerte: alerteEnvoiEmail } = useStatutEnvoiEmails();
  const envoiEmailIncomplet = !backOfficeOnly && alerteEnvoiEmail;
  const [ouvert, setOuvert] = useState(false);
  const [mdpOpen, setMdpOpen] = useState(false);
  const [sauvegardeOpen, setSauvegardeOpen] = useState(false);
  // Envoi d'un email de test directement depuis le menu, pour valider la réception sans
  // ouvrir les Préférences.
  const [testEnCours, setTestEnCours] = useState(false);
  const [testNotice, setTestNotice] = useState("");
  const [testErreur, setTestErreur] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  // Envoie un email de test à l'adresse du compte, puis affiche le retour dans le menu.
  const envoyerTest = async () => {
    if (!user?.email) {
      setTestErreur("Aucune adresse email n'est rattachée à votre compte.");
      return;
    }
    setTestEnCours(true);
    setTestNotice("");
    setTestErreur("");
    try {
      await envoyerEmailTest(user.email);
      setTestNotice(`Email de test envoyé à ${user.email}. Vérifiez votre boîte (et les indésirables).`);
    } catch (e) {
      setTestErreur(e instanceof Error ? e.message : "L'envoi de l'email de test a échoué.");
    } finally {
      setTestEnCours(false);
    }
  };

  // Fermeture au clic extérieur ou sur Échap.
  useEffect(() => {
    if (!ouvert) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [ouvert]);

  if (!user) return null;

  const displayName = backOfficeOnly
    ? isGestionnairePrincipal
      ? "Gestionnaire principal"
      : "Gestionnaire"
    : profile?.entreprise || user.email?.split("@")[0] || "Mon compte";
  const subLine = backOfficeOnly
    ? user.email || "Compte gestionnaire"
    : profile?.metier || user.email || "Espace artisan";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "AF";
  const compteLink = backOfficeOnly ? "/app/mon-compte-gestionnaire" : "/app/profil";
  const libelleCompte = backOfficeOnly ? "Mon compte gestionnaire" : "Mon profil";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        title="Menu du compte"
        className="inline-flex items-center gap-2 h-10 pl-1.5 pr-2.5 rounded-md bg-background-100 border border-background-200 text-left cursor-pointer hover:border-primary-300 transition-colors"
      >
        <span className="relative w-7 h-7 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 font-semibold text-xs shrink-0">
          {initials}
          {envoiEmailIncomplet && (
            <span
              title="Configuration d'envoi des emails à finaliser"
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-background-100"
            ></span>
          )}
        </span>
        <span className="hidden md:block min-w-0 max-w-[150px]">
          <span className="block text-xs font-semibold text-foreground-950 truncate">{displayName}</span>
          <span className="block text-[10px] text-foreground-500 truncate">{subLine}</span>
        </span>
        <i className={`ri-arrow-down-s-line text-foreground-400 transition-transform ${ouvert ? "rotate-180" : ""}`}></i>
      </button>

      {ouvert && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 z-50 w-64 p-2 rounded-lg bg-background-50 border border-background-200 animate-fade-in"
        >
          <div className="flex items-center gap-2.5 p-2">
            <span className="w-9 h-9 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 font-semibold text-sm shrink-0">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground-950 truncate">{displayName}</p>
              <p className="text-[10px] text-foreground-500 truncate">{user.email}</p>
            </div>
          </div>

          {envoiEmailIncomplet && (
            <Link
              to="/app/preferences#section-envoi-emails"
              role="menuitem"
              onClick={() => setOuvert(false)}
              className="flex items-start gap-2.5 px-2.5 py-2 rounded-md bg-primary-50 border border-primary-200 text-primary-700 cursor-pointer hover:bg-primary-100 transition-colors"
            >
              <i className="ri-error-warning-line text-primary-600 mt-0.5"></i>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">Configuration d'envoi à finaliser</span>
                <span className="block text-[10px] text-foreground-500 font-normal mt-0.5">
                  La clé ou le domaine email n'est pas encore prêt.
                </span>
              </span>
            </Link>
          )}

          <div className="px-1 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => { void envoyerTest(); }}
              disabled={testEnCours}
              title="Recevoir un email de test à l'adresse de votre compte pour valider la réception"
              className="flex items-center gap-2.5 h-9 px-2.5 rounded-md w-full text-sm font-medium text-foreground-700 cursor-pointer hover:bg-background-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <i className={`${testEnCours ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"} text-foreground-500`}></i>
              {testEnCours ? "Envoi du test…" : "Envoyer un email de test"}
            </button>
            {testNotice && (
              <p className="mx-2.5 mt-1 mb-0.5 text-[11px] text-accent-700 bg-accent-50 border border-accent-200 rounded-md px-2 py-1.5 flex items-start gap-1.5">
                <i className="ri-checkbox-circle-line mt-0.5 shrink-0"></i>
                <span>{testNotice}</span>
              </p>
            )}
            {testErreur && (
              <p className="mx-2.5 mt-1 mb-0.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5 flex items-start gap-1.5">
                <i className="ri-error-warning-line mt-0.5 shrink-0"></i>
                <span>{testErreur}</span>
              </p>
            )}
          </div>

          <div className="h-px bg-background-200 my-1" />

          <Link
            to={compteLink}
            role="menuitem"
            onClick={() => setOuvert(false)}
            className="flex items-center gap-2.5 h-10 px-2.5 rounded-md text-sm font-medium text-foreground-700 cursor-pointer hover:bg-background-100 transition-colors"
          >
            <i className="ri-user-settings-line text-foreground-500"></i>
            {libelleCompte}
          </Link>

          {!backOfficeOnly && (
            <Link
              to="/app/profil?onglet=securite"
              role="menuitem"
              onClick={() => setOuvert(false)}
              className="flex items-center gap-2.5 h-10 px-2.5 rounded-md text-sm font-medium text-foreground-700 cursor-pointer hover:bg-background-100 transition-colors"
            >
              <i className="ri-shield-keyhole-line text-foreground-500"></i>
              Sécurité du compte
            </Link>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOuvert(false);
              setSauvegardeOpen(true);
            }}
            className="flex items-center gap-2.5 h-10 px-2.5 w-full rounded-md text-sm font-medium text-foreground-700 cursor-pointer hover:bg-background-100 transition-colors"
          >
            <i className="ri-archive-drawer-line text-foreground-500"></i>
            Sauvegarder mes données
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOuvert(false);
              setMdpOpen(true);
            }}
            className="flex items-center gap-2.5 h-10 px-2.5 w-full rounded-md text-sm font-medium text-foreground-700 cursor-pointer hover:bg-background-100 transition-colors"
          >
            <i className="ri-key-2-line text-foreground-500"></i>
            Modifier mon mot de passe
          </button>

          <div className="h-px bg-background-200 my-1" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOuvert(false);
              signOut();
            }}
            className="flex items-center gap-2.5 h-10 px-2.5 w-full rounded-md text-sm font-medium text-foreground-600 cursor-pointer hover:bg-background-100 hover:text-red-600 transition-colors"
          >
            <i className="ri-logout-box-r-line"></i>
            Se déconnecter
          </button>
        </div>
      )}

      {mdpOpen && <ChangerMotDePasseModal onClose={() => setMdpOpen(false)} />}
      {sauvegardeOpen && <SauvegardeDonneesModal onClose={() => setSauvegardeOpen(false)} />}
    </div>
  );
}