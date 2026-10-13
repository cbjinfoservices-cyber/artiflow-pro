import { useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth, type GestionnairePatch } from "@/hooks/useAuth";
import { estGestionnairePrincipal } from "@/lib/roles";
import Toast from "@/components/base/Toast";
import { LoadingBlock } from "@/pages/app/components/DataState";
import AjoutGestionnaireForm from "@/pages/app/mon-compte-gestionnaire/components/AjoutGestionnaireForm";
import GestionnaireRow from "@/pages/app/mon-compte-gestionnaire/components/GestionnaireRow";
import JournalGestionnairesCard from "@/pages/app/mon-compte-gestionnaire/components/JournalGestionnairesCard";
import AccesRecapCard from "@/pages/app/mon-compte-gestionnaire/components/AccesRecapCard";
import CarteSecuriteMotDePasse from "@/components/feature/CarteSecuriteMotDePasse";

/**
 * Page de gestion des adresses reconnues comme gestionnaires. La liste est visible par
 * tous les gestionnaires, mais l'écriture (ajout, préférences, suppression) est réservée
 * au gestionnaire principal. Les identifiants de connexion restent créés dans
 * Backend → Authentification.
 */
export default function AppMonCompteGestionnaire() {
  usePageMeta(
    "Mon compte gestionnaire · ArtiFlow-pro",
    "Gestion des adresses reconnues comme gestionnaires et de leurs accès au back-office ArtiFlow-pro.",
  );

  const {
    gestionnaires,
    gestionnairesLoading,
    journal,
    journalLoading,
    isGestionnairePrincipal,
    user,
    ajouterGestionnaire,
    majGestionnaire,
    supprimerGestionnaire,
    refreshJournal,
  } = useAuth();

  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const monEmail = (user?.email ?? "").toLowerCase();

  const handleAjouter = async (
    email: string,
    voirCompta: boolean,
    voirAbo: boolean,
    libelle: string | null,
  ): Promise<boolean> => {
    setBusy(true);
    setError(null);
    const res = await ajouterGestionnaire(email, voirCompta, voirAbo, libelle);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return false;
    }
    setToast(`Adresse ajoutée : ${email.trim().toLowerCase()}`);
    return true;
  };

  const handlePatch = async (id: number, patch: GestionnairePatch) => {
    setError(null);
    const res = await majGestionnaire(id, patch);
    if (res.error) {
      setError(res.error);
      return;
    }
    setToast(
      "libelle" in patch
        ? "Libellé enregistré"
        : "note" in patch
          ? "Note interne enregistrée"
          : "Préférences mises à jour",
    );
  };

  const handleSupprimer = async (id: number, email: string) => {
    setError(null);
    const res = await supprimerGestionnaire(id);
    if (res.error) {
      setError(res.error);
      return;
    }
    setToast(`Adresse retirée : ${email}`);
  };

  const nbAdresses = gestionnaires.length;
  const pluriel = nbAdresses > 1;

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-shield-user-line text-xl"></i>
          </span>
          <div>
            <h2 className="font-heading font-bold text-lg text-foreground-950">Mon compte gestionnaire</h2>
            <p className="text-xs text-foreground-500">
              {nbAdresses} adresse{pluriel ? "s" : ""} gestionnaire{pluriel ? "s" : ""} reconnue{pluriel ? "s" : ""} · accès au back-office
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap ${
            isGestionnairePrincipal ? "bg-primary-100 text-primary-800" : "bg-secondary-100 text-secondary-800"
          }`}
        >
          <i className={isGestionnairePrincipal ? "ri-shield-star-line" : "ri-shield-user-line"}></i>
          {isGestionnairePrincipal ? "Gestionnaire principal" : "Gestionnaire"}
        </span>
      </div>

      <AccesRecapCard gestionnaires={gestionnaires} />

      <div className="flex items-start gap-3 p-4 rounded-lg bg-secondary-100 border border-secondary-200">
        <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-secondary-200 text-secondary-800">
          <i className="ri-key-2-line"></i>
        </span>
        <div className="text-xs leading-relaxed text-secondary-900">
          <p className="font-semibold">Un gestionnaire est un compte de l'application, pas un compte professionnel.</p>
          <p className="mt-1 text-secondary-800/90">
            Ajouter une adresse ici la <strong>reconnaît comme gestionnaire</strong> : elle accède uniquement au back-office
            (Abonnements, Comptabilité, cette page) et <strong>ne voit jamais l'espace artisan</strong> (devis, factures,
            clients, chantiers…). Les identifiants de connexion (email + mot de passe) se créent et se gèrent dans{" "}
            <strong>Backend → Authentification</strong>, avec exactement la même adresse — l'application ne peut ni les voir
            ni les afficher.
          </p>
        </div>
      </div>

      {!isGestionnairePrincipal && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-100 border border-accent-300 text-xs text-accent-900">
          <i className="ri-lock-line text-accent-700"></i>
          Seul le gestionnaire principal peut ajouter, modifier ou retirer des adresses. Vous consultez la liste en lecture seule.
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-red-100 border border-red-200 text-xs text-red-800">
          <span className="inline-flex items-center gap-2">
            <i className="ri-error-warning-line text-sm"></i>
            {error}
          </span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Fermer"
            className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full hover:bg-red-200 cursor-pointer"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

      <AjoutGestionnaireForm
        principal={isGestionnairePrincipal}
        disabled={!isGestionnairePrincipal}
        busy={busy}
        onSubmit={handleAjouter}
      />

      <div className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide bg-background-200/50">
          <span className="col-span-5">Adresse gestionnaire</span>
          <span className="col-span-3 text-center">Comptabilité</span>
          <span className="col-span-3 text-center">Mon abonnement</span>
          <span className="col-span-1 text-right">Action</span>
        </div>

        {gestionnairesLoading ? (
          <LoadingBlock />
        ) : nbAdresses === 0 ? (
          <p className="p-8 text-center text-sm text-foreground-500">Aucune adresse gestionnaire pour l'instant.</p>
        ) : (
          gestionnaires.map((g) => (
            <GestionnaireRow
              key={g.id}
              gestionnaire={g}
              estPrincipal={estGestionnairePrincipal(g.email)}
              estMoi={g.email.toLowerCase() === monEmail}
              lectureSeule={!isGestionnairePrincipal}
              onPatch={handlePatch}
              onSupprimer={handleSupprimer}
            />
          ))
        )}
      </div>

      <JournalGestionnairesCard
        items={journal}
        gestionnaires={gestionnaires}
        loading={journalLoading}
        onReload={refreshJournal}
      />

      <p className="text-[11px] text-foreground-400">
        Retirer une adresse gestionnaire ne supprime pas le compte de connexion : celui-ci reste gérable depuis Backend →
        Authentification.
      </p>

      {/* Sécurité du compte gestionnaire : même fenêtre de mot de passe que le profil. */}
      <CarteSecuriteMotDePasse />

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}