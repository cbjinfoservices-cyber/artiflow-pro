import { useState } from "react";
import type { ClientItem } from "@/hooks/useArtisanData";
import type { ClientPayload } from "@/lib/artisanApi";
import type { EchecEnvoiClient } from "@/hooks/useEchecsEnvoisClients";
import { NOTE_PRIORITES } from "@/lib/notePriorites";
import { verifierAdresseEmail, type VerificationAdresse } from "@/lib/verifierAdresseEmail";
import Modal from "@/pages/app/components/Modal";

/** Horodatage court et lisible d'un refus d'envoi (« 12 oct. 14:32 »). */
function formatHorodatage(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ClientFormModal({
  initial,
  busy,
  onClose,
  onSubmit,
  defaultType = "particulier",
  echecEnvoi = null,
}: {
  initial: ClientItem | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: ClientPayload, options?: { renvoyerApres?: boolean }) => void;
  /** Type présélectionné à la création (« professionnel » depuis la vue Professionnels du carnet). */
  defaultType?: string;
  /** Dernier email refusé pour ce client : contexte affiché avant de corriger l'adresse. */
  echecEnvoi?: EchecEnvoiClient | null;
}) {
  const [type, setType] = useState(initial?.type === "professionnel" ? "professionnel" : initial ? "particulier" : defaultType);
  const [nom, setNom] = useState(initial?.nom ?? "");
  const [telephone, setTelephone] = useState(initial?.telephone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [adresse, setAdresse] = useState(initial?.adresse ?? "");
  const [contactNom, setContactNom] = useState(initial?.contact_nom ?? "");
  const [siret, setSiret] = useState(initial?.siret ?? "");
  const [secteur, setSecteur] = useState(initial?.secteur ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [notePriorite, setNotePriorite] = useState(initial?.note_priorite ?? "");
  const [error, setError] = useState<string | null>(null);
  // Proposition de renvoyer l'email dès que l'adresse est corrigée (cochée par défaut).
  const [renvoyerApres, setRenvoyerApres] = useState(true);
  // Résultat de la vérification manuelle (format + domaine) de l'adresse saisie.
  const [verif, setVerif] = useState<VerificationAdresse | null>(null);

  const pro = type === "professionnel";
  // L'adresse a-t-elle réellement changé par rapport à la fiche enregistrée ?
  const emailModifie = email.trim() !== (initial?.email ?? "").trim();
  // Une vérification a signalé une adresse encore invalide : on ne propose pas de renvoyer
  // tant qu'elle n'est pas corrigée, pour ne pas repartir vers une adresse refusée.
  const adresseSuspecte = verif !== null && !verif.ok;
  // Le renvoi n'est proposé que sur une fiche existante dont un email a été refusé.
  const proposerRenvoyer = Boolean(
    initial && echecEnvoi && emailModifie && email.trim().length > 0 && !adresseSuspecte,
  );
  const inputCls =
    "h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400";

  const handleSubmit = () => {
    if (!nom.trim()) {
      setError(pro ? "La raison sociale est obligatoire." : "Le nom du client est obligatoire.");
      return;
    }
    setError(null);
    onSubmit({
      nom: nom.trim(),
      telephone: telephone.trim(),
      email: email.trim(),
      adresse: adresse.trim(),
      type,
      contact_nom: contactNom.trim(),
      siret: siret.trim(),
      secteur: secteur.trim(),
      notes: notes.trim(),
      note_priorite: notePriorite,
    }, { renvoyerApres: proposerRenvoyer && renvoyerApres });
  };

  return (
    <Modal
      title={initial ? "Modifier le client" : pro ? "Nouveau client professionnel" : "Nouveau client"}
      subtitle="Ces informations alimentent vos devis et chantiers."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap disabled:opacity-60"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
            Enregistrer
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Type de client</span>
          <div className="flex gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
            <button
              type="button"
              onClick={() => setType("particulier")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                !pro ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              <i className="ri-user-line"></i>
              Particulier
            </button>
            <button
              type="button"
              onClick={() => setType("professionnel")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                pro ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              <i className="ri-building-2-line"></i>
              Professionnel
            </button>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">{pro ? "Raison sociale" : "Nom / raison sociale"}</span>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder={pro ? "SARL Bâti Rhône" : "Mme Dupont"}
            className={inputCls}
          />
        </label>

        {pro && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground-700">Interlocuteur</span>
              <input
                value={contactNom}
                onChange={(e) => setContactNom(e.target.value)}
                placeholder="Marc Petit"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground-700">Secteur d'activité</span>
              <input
                value={secteur}
                onChange={(e) => setSecteur(e.target.value)}
                placeholder="Rénovation, Immobilier…"
                className={inputCls}
              />
            </label>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Téléphone</span>
            <input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="06 12 34 56 78" className={inputCls} />
          </label>
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-foreground-700">Email</span>
              <button
                type="button"
                onClick={() => setVerif(verifierAdresseEmail(email))}
                disabled={!email.trim()}
                title="Contrôler le format de l'adresse et son domaine avant d'enregistrer, pour éviter un renvoi vers une adresse invalide"
                className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-background-100 border border-background-200 text-[10px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-shield-check-line"></i>
                Vérifier l'adresse
              </button>
            </div>
            <input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setVerif(null);
              }}
              placeholder="client@email.fr"
              className={`${inputCls} ${adresseSuspecte ? "border-red-300" : ""}`}
            />
            {verif && (
              <div
                className={`flex flex-col gap-1 rounded-md px-2.5 py-2 border ${
                  verif.ok
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                    verif.ok ? "text-emerald-800" : "text-red-800"
                  }`}
                >
                  <i className={verif.ok ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
                  {verif.ok
                    ? "Adresse valide : format et domaine corrects"
                    : "Adresse à corriger avant tout renvoi"}
                </span>
                {verif.ok ? (
                  <span className="text-[10px] text-foreground-500 leading-snug break-all">
                    {verif.adresse}
                  </span>
                ) : (
                  <ul className="flex flex-col gap-0.5">
                    {verif.problemes.map((p) => (
                      <li key={p} className="flex items-start gap-1 text-[10px] text-red-700 leading-snug">
                        <i className="ri-arrow-right-s-line mt-[1px]"></i>
                        <span className="min-w-0">{p}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {verif.suggestion && (
                  <button
                    type="button"
                    onClick={() => {
                      const propose = verif.suggestion;
                      if (!propose) return;
                      setEmail(propose);
                      setVerif(null);
                    }}
                    className="mt-0.5 self-start inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-primary-500 text-background-50 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                  >
                    <i className="ri-magic-line"></i>
                    Utiliser {verif.suggestion}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Contexte avant correction : on rappelle le dernier refus (date + raison)
            pour ne pas corriger l'adresse à l'aveugle. */}
        {initial && echecEnvoi && (
          <div className="flex flex-col gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-800">
              <i className="ri-mail-close-line"></i>
              Dernier email refusé
            </span>
            <div className="flex flex-col gap-0.5 text-[11px] text-foreground-600">
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <i className="ri-calendar-line text-red-600"></i>
                {formatHorodatage(echecEnvoi.created_at)}
                {echecEnvoi.destinataire?.trim() ? (
                  <span className="inline-flex items-center gap-1 text-foreground-500">
                    <i className="ri-at-line"></i>
                    {echecEnvoi.destinataire}
                  </span>
                ) : null}
              </span>
              <span className="text-red-700 break-words" title={echecEnvoi.erreur ?? undefined}>
                {echecEnvoi.erreur?.trim() ? echecEnvoi.erreur : "Le service d'envoi a refusé cet email."}
              </span>
            </div>
            {proposerRenvoyer ? (
              <label className="flex items-start gap-2 rounded-md bg-background-50 border border-red-200 px-2.5 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={renvoyerApres}
                  onChange={(e) => setRenvoyerApres(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-primary-500 cursor-pointer"
                />
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold text-foreground-900">
                    Renvoyer l'email automatiquement après enregistrement
                  </span>
                  <span className="block text-[10px] text-foreground-500 leading-snug">
                    L'adresse corrigée ({email.trim() || "—"}) servira immédiatement à réexpédier le dernier email refusé.
                  </span>
                </span>
              </label>
            ) : (
              <p className="text-[10px] text-foreground-500 leading-snug inline-flex items-center gap-1">
                <i className="ri-information-line"></i>
                {adresseSuspecte
                  ? "Cette adresse est encore invalide : corrigez-la (ou utilisez la suggestion) pour débloquer le renvoi."
                  : "Corrigez l'adresse email ci-dessus : le renvoi automatique vous sera proposé."}
              </p>
            )}
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Adresse</span>
          <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="12 rue de la Charité, Lyon 6e" className={inputCls} />
        </label>

        {pro && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">SIRET (optionnel)</span>
            <input value={siret} onChange={(e) => setSiret(e.target.value)} placeholder="812 345 678 00019" className={inputCls} />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700 inline-flex items-center gap-1.5">
            <i className="ri-sticky-note-line text-foreground-400"></i>
            Notes internes (optionnel)
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notes visibles uniquement par vous : préférences, historique, points de vigilance…"
            className="px-3 py-2 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400 resize-none"
          />
        </label>

        {notes.trim().length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700 inline-flex items-center gap-1.5">
              <i className="ri-flag-line text-foreground-400"></i>
              Priorité de la note
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setNotePriorite("")}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  notePriorite === ""
                    ? "bg-foreground-900 border-foreground-900 text-background-50"
                    : "bg-background-100 border-background-200 text-foreground-600 hover:border-foreground-400"
                }`}
              >
                <i className="ri-forbid-2-line"></i>
                Aucune
              </button>
              {NOTE_PRIORITES.map((p) => {
                const actif = notePriorite === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setNotePriorite(p.key)}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      actif ? `${p.badge}` : "bg-background-100 border-background-200 text-foreground-600 hover:border-foreground-400"
                    }`}
                  >
                    <i className={p.icon}></i>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}