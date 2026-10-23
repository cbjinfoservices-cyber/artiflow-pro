import { useState } from "react";
import { COULEURS_INTERVENANT, validiteCodeInvitation, type Intervenant, type IntervenantPayload } from "@/lib/intervenants";
import { formatDateHeureCourte } from "@/lib/dates";
import BoutonCopierCode from "@/components/base/BoutonCopierCode";
import Modal from "@/pages/app/components/Modal";

/**
 * Formulaire d'ajout / d'édition d'un intervenant de l'entreprise.
 * On y renseigne le nom, le métier, le téléphone, une couleur de repérage et l'état actif.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function IntervenantFormModal({
  intervenant,
  busy,
  onClose,
  onSubmit,
  onInviter,
}: {
  /** Intervenant existant en édition, ou null pour une création. */
  intervenant: Intervenant | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: IntervenantPayload) => void;
  /** Envoie l'invitation par email à l'adresse indiquée ; renvoie un message d'erreur ou le code associé. */
  onInviter: (email: string, nom: string) => Promise<{ error: string | null; code?: string | null; expire?: string | null }>;
}) {
  const [nom, setNom] = useState(intervenant?.nom ?? "");
  const [metier, setMetier] = useState(intervenant?.metier ?? "");
  const [telephone, setTelephone] = useState(intervenant?.telephone ?? "");
  const [compteEmail, setCompteEmail] = useState(intervenant?.compte_email ?? "");
  const [couleur, setCouleur] = useState(intervenant?.couleur ?? COULEURS_INTERVENANT[0].cle);
  const [actif, setActif] = useState(intervenant?.actif ?? true);
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Retour visuel après la copie de l'adresse email (rappel « adresse exacte »).
  const [copieOk, setCopieOk] = useState(false);
  // Date du dernier envoi d'invitation : initialisée depuis la fiche, rafraîchie après un envoi.
  const [dernierEnvoi, setDernierEnvoi] = useState<string | null>(intervenant?.invitation_envoyee_le ?? null);
  // Code d'invitation : généré à l'enregistrement de la fiche (email requis). Sert à confirmer
  // le rattachement du compte si l'inscription se fait avec une autre adresse que celle de la fiche.
  const [codeInvitation, setCodeInvitation] = useState<string | null>(intervenant?.code_invitation ?? null);
  // Date d'expiration du code : initialisée depuis la fiche, rafraîchie après un envoi d'invitation.
  const [expireInvitation, setExpireInvitation] = useState<string | null>(intervenant?.code_invitation_expire_le ?? null);
  const validite = validiteCodeInvitation({
    code_invitation: codeInvitation,
    code_invitation_expire_le: expireInvitation,
  });

  const emailValide = EMAIL_RE.test(compteEmail.trim());
  const dejaInvite = Boolean(dernierEnvoi);

  const envoyerInvitation = async () => {
    if (!emailValide) {
      setInviteMsg({ ok: false, text: "Renseignez d'abord une adresse email valide." });
      return;
    }
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await onInviter(compteEmail.trim().toLowerCase(), nom.trim());
      if (res.error) {
        setInviteMsg({ ok: false, text: res.error });
      } else {
        setDernierEnvoi(new Date().toISOString());
        if (res.code) setCodeInvitation(res.code);
        if (res.expire) setExpireInvitation(res.expire);
        setInviteMsg({ ok: true, text: `Invitation envoyée à ${compteEmail.trim()}.` });
      }
    } finally {
      setInviting(false);
    }
  };

  // Copie l'adresse dans le presse-papiers : facilite le rappel « adresse exacte » à l'inscription.
  const copierEmail = async () => {
    try {
      await navigator.clipboard.writeText(compteEmail.trim());
      setCopieOk(true);
      window.setTimeout(() => setCopieOk(false), 2000);
    } catch {
      setCopieOk(false);
    }
  };

  const inputCls = "h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400";

  const handleSubmit = () => {
    if (!nom.trim()) {
      setError("Indiquez au moins le nom de l'intervenant.");
      return;
    }
    setError(null);
    onSubmit({ nom: nom.trim(), metier: metier.trim() || null, telephone: telephone.trim() || null, couleur, compte_email: compteEmail.trim() || null, actif });
  };

  return (
    <Modal
      title={intervenant ? "Modifier l'intervenant" : "Ajouter un intervenant"}
      subtitle="Les intervenants sont les personnes que vous pouvez affecter à un créneau."
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
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-check-line"></i>}
            {intervenant ? "Enregistrer" : "Ajouter"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Nom de l'intervenant</span>
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Karim Benali" className={inputCls} />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Métier / rôle (optionnel)</span>
            <input value={metier} onChange={(e) => setMetier(e.target.value)} placeholder="Électricien" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Téléphone (optionnel)</span>
            <input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="06 12 34 56 78" className={inputCls} />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Email du compte (accès à son planning)</span>
            <input type="email" value={compteEmail} onChange={(e) => setCompteEmail(e.target.value)} placeholder="karim@exemple.fr" className={inputCls} />
            <span className="text-[11px] text-foreground-500">
              Renseignez l'adresse avec laquelle {nom.trim() || "l'intervenant"} se connectera pour voir son propre planning. Il crée ensuite son compte depuis la page de connexion.
            </span>
          </label>

          {/* Rappel bien visible : l'inscription doit se faire avec cette adresse EXACTE, sinon
              le compte ne sera pas rattaché à la fiche et l'intervenant ne verra pas son planning. */}
          {emailValide && (
            <div className="flex items-start gap-2.5 rounded-md bg-accent-100 border border-accent-200 p-2.5">
              <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50">
                <i className="ri-alert-line text-sm"></i>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-foreground-900">Créez le compte avec cette adresse exacte</p>
                <p className="text-[11px] text-foreground-600 leading-relaxed">
                  {nom.trim() || "L'intervenant"} doit s'inscrire avec {" "}
                  <strong className="text-foreground-900 break-all">{compteEmail.trim()}</strong> — c'est la seule adresse qui relie son compte à sa fiche.
                </p>
                <button
                  type="button"
                  onClick={copierEmail}
                  className="mt-1 inline-flex items-center gap-1 h-6 px-2 rounded bg-background-50 border border-accent-300 text-[10px] font-semibold text-accent-800 whitespace-nowrap cursor-pointer hover:bg-accent-50 transition-colors"
                >
                  <i className={copieOk ? "ri-check-line" : "ri-file-copy-line"}></i>
                  {copieOk ? "Adresse copiée" : "Copier l'adresse"}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <button
                type="button"
                onClick={envoyerInvitation}
                disabled={inviting || !emailValide}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 disabled:opacity-50 transition-colors"
              >
                {inviting ? <i className="ri-loader-4-line animate-spin"></i> : <i className={dejaInvite ? "ri-refresh-line" : "ri-mail-send-line"}></i>}
                {dejaInvite ? "Renvoyer l'invitation par email" : "Envoyer l'invitation par email"}
              </button>
              {inviteMsg && (
                <span className={`text-[11px] inline-flex items-center gap-1 ${inviteMsg.ok ? "text-secondary-700" : "text-red-600"}`}>
                  <i className={inviteMsg.ok ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
                  {inviteMsg.text}
                </span>
              )}
            </div>
            <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
              <i className="ri-history-line"></i>
              {dernierEnvoi
                ? `Dernier envoi : ${formatDateHeureCourte(dernierEnvoi)}`
                : "Aucune invitation envoyée pour le moment."}
            </span>
          </div>

          {/* Code d'invitation : la clé qui relie le compte à la fiche, même si l'inscription
              se fait avec une autre adresse. Il est envoyé dans l'email d'invitation. */}
          {codeInvitation && (
            <div className="flex items-start gap-2.5 rounded-md bg-secondary-100 border border-secondary-200 p-2.5">
              <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-secondary-500 text-background-50">
                <i className="ri-key-2-line text-sm"></i>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-foreground-900">Code d'invitation</p>
                <p className="text-[11px] text-foreground-600 leading-relaxed">
                  Transmis dans l'email d'invitation. Si le compte n'est pas reconnu automatiquement, il sert à le
                  rattacher à cette fiche depuis « Rattacher mon compte ».
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-background-50 border border-secondary-300 text-xs font-bold tracking-[0.2em] text-foreground-900">
                    {codeInvitation}
                  </span>
                  <BoutonCopierCode code={codeInvitation} />
                </div>
                {validite.joursRestants !== null && (
                  <p
                    className={`text-[10px] mt-1 inline-flex items-center gap-1 ${
                      validite.expire ? "text-red-600" : validite.expireBientot ? "text-accent-700" : "text-foreground-500"
                    }`}
                  >
                    <i className={validite.expire ? "ri-error-warning-line" : "ri-timer-line"}></i>
                    {validite.expire
                      ? "Ce code a expiré : régénérez-le depuis la liste Intervenants pour en envoyer un nouveau."
                      : validite.expireBientot
                        ? `Ce code expire dans ${validite.joursRestants} jour${validite.joursRestants > 1 ? "s" : ""}.`
                        : `Code valable encore ${validite.joursRestants} jour${validite.joursRestants > 1 ? "s" : ""}.`}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Couleur de repérage</span>
          <div className="flex flex-wrap gap-2">
            {COULEURS_INTERVENANT.map((c) => (
              <button
                key={c.cle}
                type="button"
                onClick={() => setCouleur(c.cle)}
                aria-label={c.label}
                title={c.label}
                className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-transform ${
                  couleur === c.cle ? "ring-2 ring-offset-2 ring-foreground-400 scale-105" : "hover:scale-105"
                }`}
                style={{ backgroundColor: c.hex }}
              >
                {couleur === c.cle && <i className="ri-check-line text-white text-sm"></i>}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 p-3 rounded-md bg-background-100 border border-background-200 cursor-pointer">
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} className="w-4 h-4 accent-primary-500 cursor-pointer" />
          <span className="flex-1">
            <span className="block text-sm font-medium text-foreground-800">Intervenant actif</span>
            <span className="block text-[11px] text-foreground-500">
              Un intervenant inactif reste enregistré mais n'apparaît plus dans les sélecteurs.
            </span>
          </span>
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}