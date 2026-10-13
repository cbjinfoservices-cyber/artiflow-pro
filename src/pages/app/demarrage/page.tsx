import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/hooks/useAuth";
import { useArtisanData } from "@/hooks/useArtisanData";
import { createClient, createDevis, type ClientPayload, type LigneInput } from "@/lib/artisanApi";
import { saveOnboardingMetier, setOnboardingDone } from "@/lib/onboarding";
import { METIERS, metierLabel } from "@/lib/metiers";
import DevisFormModal from "@/pages/app/devis/components/DevisFormModal";

/** Étapes du parcours de démarrage. */
const ETAPES: { key: string; label: string; icon: string }[] = [
  { key: "metier", label: "Votre métier", icon: "ri-briefcase-line" },
  { key: "client", label: "Premier client", icon: "ri-user-add-line" },
  { key: "devis", label: "Premier devis", icon: "ri-file-text-line" },
];

const inputCls =
  "h-11 px-3.5 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-900 placeholder:text-foreground-400 outline-none focus:border-primary-400 transition-colors";

/**
 * Parcours de démarrage guidé, proposé juste après l'inscription : on confirme le métier,
 * on crée un premier client, puis un premier devis. On peut le passer à tout moment ; une
 * fois terminé (ou passé), il ne réapparaît plus.
 */
export default function AppDemarrage() {
  usePageMeta("Bienvenue · ArtiFlow-pro", "Faites vos premiers pas sur ArtiFlow-pro.");
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { clients, reload } = useArtisanData();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Étape 1 — métier
  const [entreprise, setEntreprise] = useState("");
  const [metier, setMetier] = useState("");
  const [telephone, setTelephone] = useState("");

  // Étape 2 — premier client
  const [clientNom, setClientNom] = useState("");
  const [clientTel, setClientTel] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAdresse, setClientAdresse] = useState("");
  const [clientCree, setClientCree] = useState<string | null>(null);

  // Étape 3 — premier devis
  const [devisOpen, setDevisOpen] = useState(false);
  const [devisBusy, setDevisBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setEntreprise(profile.entreprise ?? "");
      setMetier(profile.metier ?? "");
      setTelephone(profile.telephone ?? "");
    }
  }, [profile]);

  const prenom = (profile?.entreprise || user?.email?.split("@")[0] || "").trim();

  /** Termine le parcours (ou le passe) et rejoint l'espace artisan. */
  const terminer = async () => {
    if (user) {
      try {
        await setOnboardingDone(user.id, true);
      } catch {
        /* best effort : on laisse l'artisan entrer dans son espace */
      }
      await refreshProfile();
    }
    navigate("/app", { replace: true });
  };

  /** Étape 1 → enregistre le métier puis passe au premier client. */
  const enregistrerMetier = async () => {
    if (!user) return;
    if (!metier) {
      setError("Choisissez votre métier pour personnaliser ArtiFlow-pro.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveOnboardingMetier(user.id, { entreprise, metier, telephone });
      await refreshProfile();
      setStep(1);
    } catch {
      setError("L'enregistrement a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  /** Étape 2 → crée le premier client puis passe au premier devis. */
  const enregistrerClient = async () => {
    if (!user) return;
    if (!clientNom.trim()) {
      setError("Indiquez au moins le nom de votre client.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createClient(user.id, {
        nom: clientNom.trim(),
        telephone: clientTel.trim(),
        email: clientEmail.trim(),
        adresse: clientAdresse.trim(),
      });
      setClientCree(created.nom);
      await reload();
      setStep(2);
    } catch {
      setError("La création du client a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  /** Instantané d'un client créé à la volée depuis la fenêtre de devis. */
  const handleQuickCreateClient = async (payload: ClientPayload) => {
    if (!user) return null;
    const created = await createClient(user.id, payload);
    await reload();
    return created;
  };

  /** Étape 3 → enregistre le premier devis puis termine le parcours. */
  const enregistrerDevis = async (payload: {
    clientId: number | null;
    objet: string;
    statut: string;
    lignes: LigneInput[];
  }) => {
    if (!user) return;
    setDevisBusy(true);
    setError(null);
    try {
      await createDevis(user.id, payload);
      await reload();
      setDevisOpen(false);
      await terminer();
    } catch {
      setError("La création du devis a échoué. Réessayez.");
    } finally {
      setDevisBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-50 flex flex-col">
      {/* En-tête */}
      <header className="h-16 shrink-0 flex items-center justify-between px-4 md:px-8 border-b border-background-200">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-500 text-background-50">
            <i className="ri-tools-fill text-lg"></i>
          </span>
          <span className="font-heading font-bold text-lg text-foreground-950">ArtiFlow-pro</span>
        </div>
        <button
          type="button"
          onClick={terminer}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md text-sm font-medium text-foreground-500 hover:bg-background-200 hover:text-foreground-900 cursor-pointer whitespace-nowrap transition-colors"
        >
          Passer pour l'instant
          <i className="ri-arrow-right-line"></i>
        </button>
      </header>

      <main className="flex-1 flex justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-2xl">
          {/* Titre de bienvenue */}
          <div className="text-center mb-7">
            <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-accent-100 text-accent-800 text-xs font-semibold">
              <i className="ri-sparkling-2-line"></i>
              Bienvenue{prenom ? ` ${prenom}` : ""} sur ArtiFlow-pro
            </span>
            <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 mt-3">
              Faisons vos trois premiers pas
            </h1>
            <p className="text-sm text-foreground-500 mt-2 max-w-md mx-auto">
              Quelques minutes suffisent pour configurer votre espace et voir ArtiFlow-pro travailler pour vous.
            </p>
          </div>

          {/* Progression */}
          <div className="flex items-center justify-center gap-2 mb-7">
            {ETAPES.map((e, i) => {
              const actif = i === step;
              const fait = i < step;
              return (
                <div key={e.key} className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors ${
                        fait
                          ? "bg-accent-500 text-background-50"
                          : actif
                            ? "bg-primary-500 text-background-50"
                            : "bg-background-100 border border-background-200 text-foreground-400"
                      }`}
                    >
                      <i className={fait ? "ri-check-line" : e.icon}></i>
                    </span>
                    <span
                      className={`text-xs font-semibold whitespace-nowrap hidden sm:block ${
                        actif ? "text-foreground-950" : "text-foreground-500"
                      }`}
                    >
                      {e.label}
                    </span>
                  </div>
                  {i < ETAPES.length - 1 && (
                    <span className={`w-8 h-px ${i < step ? "bg-accent-400" : "bg-background-300"}`}></span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Contenu de l'étape */}
          <div className="p-6 md:p-7 rounded-lg bg-background-100 border border-background-200">
            {error && (
              <p className="mb-4 text-xs text-red-600 flex items-center gap-1.5">
                <i className="ri-error-warning-line"></i>
                {error}
              </p>
            )}

            {step === 0 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700 text-xl">
                    <i className="ri-briefcase-line"></i>
                  </span>
                  <div>
                    <h2 className="font-heading font-semibold text-base text-foreground-950">Votre métier</h2>
                    <p className="text-xs text-foreground-500">
                      Il adapte les modèles de devis et le vocabulaire de votre espace.
                    </p>
                  </div>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-foreground-700">Nom de l'entreprise</span>
                  <input
                    value={entreprise}
                    onChange={(e) => setEntreprise(e.target.value)}
                    placeholder="Plomberie Benali"
                    className={inputCls}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-foreground-700">Métier *</span>
                  <select value={metier} onChange={(e) => setMetier(e.target.value)} className={`${inputCls} cursor-pointer`}>
                    <option value="">Sélectionnez votre métier</option>
                    {METIERS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-foreground-700">Téléphone</span>
                  <input
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="06 12 34 56 78"
                    className={inputCls}
                  />
                </label>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={enregistrerMetier}
                    disabled={busy}
                    className="inline-flex items-center gap-2 h-11 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-arrow-right-line"></i>}
                    Continuer
                  </button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-xl">
                    <i className="ri-user-add-line"></i>
                  </span>
                  <div>
                    <h2 className="font-heading font-semibold text-base text-foreground-950">Votre premier client</h2>
                    <p className="text-xs text-foreground-500">
                      Ajoutez un client pour pouvoir lui adresser un devis juste après.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-xs font-medium text-foreground-700">Nom du client *</span>
                    <input
                      value={clientNom}
                      onChange={(e) => setClientNom(e.target.value)}
                      placeholder="Mme Dupont"
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-foreground-700">Téléphone</span>
                    <input
                      value={clientTel}
                      onChange={(e) => setClientTel(e.target.value)}
                      placeholder="06 12 34 56 78"
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-foreground-700">Email</span>
                    <input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="client@email.fr"
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-xs font-medium text-foreground-700">Adresse</span>
                    <input
                      value={clientAdresse}
                      onChange={(e) => setClientAdresse(e.target.value)}
                      placeholder="12 rue des Lilas, 75011 Paris"
                      className={inputCls}
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={terminer}
                    className="text-xs font-medium text-foreground-500 hover:text-foreground-800 cursor-pointer whitespace-nowrap"
                  >
                    Je le ferai plus tard
                  </button>
                  <button
                    type="button"
                    onClick={enregistrerClient}
                    disabled={busy}
                    className="inline-flex items-center gap-2 h-11 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-add-line"></i>}
                    Ajouter ce client
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700 text-xl">
                    <i className="ri-file-text-line"></i>
                  </span>
                  <div>
                    <h2 className="font-heading font-semibold text-base text-foreground-950">Votre premier devis</h2>
                    <p className="text-xs text-foreground-500">
                      Composez un devis : vous pourrez ensuite le faire signer et le relancer en un clic.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 p-3 rounded-md bg-background-50 border border-background-200">
                  <span className="inline-flex items-center gap-2 text-sm text-foreground-700">
                    <i className="ri-checkbox-circle-fill text-accent-500"></i>
                    Métier : {metierLabel(metier) || "non renseigné"}
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm text-foreground-700">
                    <i className={`${clientCree ? "ri-checkbox-circle-fill text-accent-500" : "ri-checkbox-blank-circle-line text-foreground-300"}`}></i>
                    {clientCree ? `Client « ${clientCree} » créé` : clients.length > 0 ? `${clients.length} client(s) déjà enregistré(s)` : "Aucun client pour l'instant"}
                  </span>
                </div>

                {clients.length === 0 && !clientCree && (
                  <p className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
                    <i className="ri-information-line"></i>
                    Vous pouvez créer un client directement depuis la fenêtre « Nouveau devis ».
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={terminer}
                    className="text-xs font-medium text-foreground-500 hover:text-foreground-800 cursor-pointer whitespace-nowrap"
                  >
                    Terminer plus tard
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setDevisOpen(true);
                    }}
                    className="inline-flex items-center gap-2 h-11 px-6 rounded-md bg-accent-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
                  >
                    <i className="ri-magic-line"></i>
                    Créer mon premier devis
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Barre de progression textuelle */}
          <p className="text-center text-[11px] text-foreground-400 mt-4">
            Étape {step + 1} sur {ETAPES.length} · vous pourrez tout retrouver dans votre espace à tout moment.
          </p>
        </div>
      </main>

      {devisOpen && (
        <DevisFormModal
          clients={clients}
          busy={devisBusy}
          onClose={() => setDevisOpen(false)}
          onSubmit={enregistrerDevis}
          onQuickCreateClient={handleQuickCreateClient}
          initialObjet=""
        />
      )}
    </div>
  );
}