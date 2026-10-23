import { useState } from "react";
import { couleurIntervenant, metaInvitation, validiteCodeInvitation, type Intervenant, type IntervenantPayload } from "@/lib/intervenants";
import { formatDateHeureCourte } from "@/lib/dates";
import { useAuth } from "@/hooks/useAuth";
import { previewRecapInvitations, runRecapInvitationsNow } from "@/lib/recapInvitationsIntervenants";
import BoutonCopierCode from "@/components/base/BoutonCopierCode";
import Modal from "@/pages/app/components/Modal";
import IntervenantFormModal from "@/pages/app/planning/components/IntervenantFormModal";

/** Filtres d'affichage de la liste des intervenants. */
type Filtre = "tous" | "relance" | "invites";

/** Options de tri de la liste. */
type Tri = "defaut" | "etat";

/**
 * Modale de gestion de l'équipe : liste les intervenants, permet d'en ajouter, d'en modifier,
 * de les activer/désactiver et d'en supprimer. Les créneaux d'un intervenant supprimé sont
 * simplement désaffectés (aucune intervention n'est perdue).
 *
 * La liste met en évidence les fiches « invitées mais sans compte » (l'invitation est partie
 * mais l'intervenant n'a jamais créé son compte) pour les relancer d'un clic, et permet de
 * copier ou de régénérer le code d'invitation directement depuis la ligne.
 */
export default function IntervenantsManagerModal({
  intervenants,
  busy,
  onClose,
  onSave,
  onToggle,
  onDelete,
  onInviter,
  onRegenererCode,
}: {
  intervenants: Intervenant[];
  busy: boolean;
  onClose: () => void;
  onSave: (payload: IntervenantPayload, id: number | null) => void;
  onToggle: (id: number, actif: boolean) => void;
  onDelete: (id: number) => void;
  /** Envoie l'invitation par email à l'adresse indiquée ; renvoie un message d'erreur ou null. */
  onInviter: (email: string, nom: string) => Promise<{ error: string | null }>;
  /** Génère un nouveau code d'invitation pour la fiche (l'ancien est invalidé). */
  onRegenererCode: (id: number) => Promise<{ code: string | null; error: string | null }>;
}) {
  const { user } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Intervenant | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Intervenant | null>(null);
  const [confirmRegen, setConfirmRegen] = useState<Intervenant | null>(null);
  const [invitingId, setInvitingId] = useState<number | null>(null);
  const [inviteStatus, setInviteStatus] = useState<{ id: number; ok: boolean; text: string } | null>(null);
  const [filtre, setFiltre] = useState<Filtre>("tous");
  // Toggle d'allègement : masque les fiches dont le compte est déjà rattaché (tout est en ordre).
  const [masquerRattaches, setMasquerRattaches] = useState(false);
  // Tri de la liste : ordre naturel, ou par état d'invitation (jamais invité → invité → compte rattaché).
  const [tri, setTri] = useState<Tri>("defaut");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<{ ok: boolean; text: string } | null>(null);
  // Régénération en cours sur une fiche donnée, et message de retour associé.
  const [regenId, setRegenId] = useState<number | null>(null);
  const [regenStatus, setRegenStatus] = useState<{ id: number; ok: boolean; text: string } | null>(null);
  // Test du récap des invitations depuis la fenêtre (aperçu + envoi immédiat, sans attendre le cron).
  const [recapApercuOuvert, setRecapApercuOuvert] = useState(false);
  const [recapApercuHtml, setRecapApercuHtml] = useState<string | null>(null);
  const [recapApercuEtat, setRecapApercuEtat] = useState<"idle" | "chargement" | "succes" | "erreur">(
    "idle",
  );
  const [recapEnvoiEtat, setRecapEnvoiEtat] = useState<"idle" | "chargement" | "succes" | "erreur">(
    "idle",
  );
  const [recapMessage, setRecapMessage] = useState<string | null>(null);

  const actifs = intervenants.filter((i) => i.actif);
  const inactifs = intervenants.filter((i) => !i.actif);
  // Un intervenant dont le compte est déjà rattaché n'a plus besoin d'être relancé ni invité.
  const aRelancer = actifs.filter((i) => !i.compte_rattache && metaInvitation(i).relance);
  // Intervenants « jamais invités » disposant d'un email : cibles de l'envoi groupé en un clic.
  const jamaisInvites = actifs.filter((i) => !i.compte_rattache && i.compte_email && metaInvitation(i).niveau === "jamais");
  // Fiches « invitées mais sans compte » : l'invitation (avec le code) est partie, mais le
  // compte n'a jamais été créé. Ce sont celles que l'on veut repérer et relancer d'un clic.
  const invitesSansCompte = actifs.filter((i) => !i.compte_rattache && i.compte_email && i.invitation_envoyee_le);
  // Nombre d'intervenants dont le compte a réellement été créé (repère de confirmation).
  const rattaches = actifs.filter((i) => i.compte_rattache).length;
  // Fiches dont le code d'invitation est expiré (compte non créé) : ce sont les fiches « bloquées »
  // à relancer avec un code neuf. On distingue celles qui ont un email (directement actionnables).
  const codesExpires = actifs.filter(
    (i) => !i.compte_rattache && Boolean(i.code_invitation) && validiteCodeInvitation(i).expire,
  );
  const codesExpiresAvecEmail = codesExpires.filter((i) => Boolean(i.compte_email));
  // Compteur global : combien de personnes restent à inviter (jamais invitées, email renseigné).
  const invitationsAEnvoyer = jamaisInvites.length;
  // Rang d'état d'invitation pour le tri : jamais invité (0) → invité sans compte (1) → compte
  // rattaché (2). Les fiches sans email (3) ferment le ban : rien à relancer côté compte.
  const rangInvitation = (i: Intervenant): number => {
    if (i.compte_rattache) return 2;
    if (!i.compte_email) return 3;
    if (i.invitation_envoyee_le) return 1;
    return 0;
  };
  // Liste affichée selon le filtre choisi, allégée si l'on masque les comptes rattachés, puis triée.
  const affichesBase = (filtre === "relance" ? aRelancer : filtre === "invites" ? invitesSansCompte : actifs).filter(
    (i) => !(masquerRattaches && i.compte_rattache),
  );
  const affiches =
    tri === "etat" ? [...affichesBase].sort((a, b) => rangInvitation(a) - rangInvitation(b)) : affichesBase;

  const ouvrirCreation = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const ouvrirEdition = (i: Intervenant) => {
    setEditing(i);
    setFormOpen(true);
  };
  const handleSubmit = (payload: IntervenantPayload) => {
    onSave(payload, editing?.id ?? null);
    setFormOpen(false);
    setEditing(null);
  };

  const inviter = async (i: Intervenant) => {
    if (!i.compte_email) return;
    setInvitingId(i.id);
    setInviteStatus(null);
    try {
      const res = await onInviter(i.compte_email, i.nom);
      setInviteStatus(
        res.error
          ? { id: i.id, ok: false, text: res.error }
          : { id: i.id, ok: true, text: `Invitation envoyée à ${i.compte_email}.` },
      );
    } finally {
      setInvitingId(null);
    }
  };

  // Envoie l'invitation à tous les intervenants jamais invités, en une seule fois.
  const inviterTous = async () => {
    if (jamaisInvites.length === 0) return;
    setBulkBusy(true);
    setBulkStatus(null);
    setInviteStatus(null);
    let ok = 0;
    let ko = 0;
    for (const i of jamaisInvites) {
      if (!i.compte_email) continue;
      try {
        const res = await onInviter(i.compte_email, i.nom);
        if (res.error) ko += 1;
        else ok += 1;
      } catch {
        ko += 1;
      }
    }
    setBulkBusy(false);
    if (ok === 0 && ko === 0) {
      setBulkStatus({ ok: false, text: "Aucune invitation à envoyer." });
      return;
    }
    if (ko === 0) {
      setBulkStatus({ ok: true, text: `${ok} invitation${ok > 1 ? "s" : ""} envoyée${ok > 1 ? "s" : ""}.` });
    } else if (ok === 0) {
      setBulkStatus({ ok: false, text: `Envoi impossible (${ko} échec${ko > 1 ? "s" : ""}). Vérifiez les adresses.` });
    } else {
      setBulkStatus({ ok: false, text: `${ok} invitation${ok > 1 ? "s" : ""} envoyée${ok > 1 ? "s" : ""}, ${ko} en échec.` });
    }
  };

  // Relance d'un clic toutes les fiches invitées mais sans compte (renvoi de l'invitation).
  const relancerTousInvites = async () => {
    if (invitesSansCompte.length === 0) return;
    setBulkBusy(true);
    setBulkStatus(null);
    setInviteStatus(null);
    let ok = 0;
    let ko = 0;
    for (const i of invitesSansCompte) {
      if (!i.compte_email) continue;
      try {
        const res = await onInviter(i.compte_email, i.nom);
        if (res.error) ko += 1;
        else ok += 1;
      } catch {
        ko += 1;
      }
    }
    setBulkBusy(false);
    if (ok === 0 && ko === 0) {
      setBulkStatus({ ok: false, text: "Aucune invitation à relancer." });
      return;
    }
    if (ko === 0) {
      setBulkStatus({ ok: true, text: `${ok} relance${ok > 1 ? "s" : ""} envoyée${ok > 1 ? "s" : ""}.` });
    } else if (ok === 0) {
      setBulkStatus({ ok: false, text: `Relance impossible (${ko} échec${ko > 1 ? "s" : ""}). Vérifiez les adresses.` });
    } else {
      setBulkStatus({ ok: false, text: `${ok} relance${ok > 1 ? "s" : ""} envoyée${ok > 1 ? "s" : ""}, ${ko} en échec.` });
    }
  };

  // Copie le code d'invitation, puis envoie automatiquement l'invitation : le nouveau code
  // part sans que l'on ait à penser à relancer à la main. C'est le garde-fou anti-oubli.
  const regenerer = async (i: Intervenant) => {
    setRegenId(i.id);
    setRegenStatus(null);
    try {
      const res = await onRegenererCode(i.id);
      if (res.error) {
        setRegenStatus({ id: i.id, ok: false, text: res.error });
        return;
      }
      if (!i.compte_email) {
        setRegenStatus({
          id: i.id,
          ok: true,
          text: "Nouveau code généré. Renseignez un email de compte pour transmettre l'invitation.",
        });
        return;
      }
      // Envoi immédiat de l'invitation contenant le nouveau code (l'ancien est déjà invalidé).
      const envoi = await onInviter(i.compte_email, i.nom);
      setRegenStatus(
        envoi.error
          ? {
              id: i.id,
              ok: false,
              text: `Nouveau code généré, mais l'envoi de l'invitation a échoué : ${envoi.error}`,
            }
          : {
              id: i.id,
              ok: true,
              text: `Nouveau code généré et invitation renvoyée à ${i.compte_email}.`,
            },
      );
    } finally {
      setRegenId(null);
    }
  };

  // Ouvre l'aperçu de l'email de récap des invitations, sans rien envoyer.
  const ouvrirApercuRecap = async () => {
    if (!user) return;
    setRecapApercuOuvert(true);
    setRecapApercuEtat("chargement");
    setRecapApercuHtml(null);
    try {
      const res = await previewRecapInvitations(user.id);
      setRecapApercuHtml(res.html);
      setRecapApercuEtat("succes");
    } catch {
      setRecapApercuEtat("erreur");
    }
  };

  // Envoie tout de suite le récap des invitations à l'adresse du responsable (sans attendre le cron).
  const envoyerRecapMaintenant = async () => {
    if (!user) return;
    setRecapEnvoiEtat("chargement");
    setRecapMessage(null);
    try {
      const res = await runRecapInvitationsNow(user.id);
      if (res.sent > 0) {
        setRecapEnvoiEtat("succes");
        setRecapMessage("Le récap des invitations vient d'être envoyé à votre adresse.");
      } else if (res.nbFiches === 0) {
        setRecapEnvoiEtat("erreur");
        setRecapMessage("Rien à relancer : aucune fiche invitée sans compte pour l'instant.");
      } else {
        setRecapEnvoiEtat("erreur");
        setRecapMessage(res.reason || "L'envoi n'a pas abouti (Resend non configuré ou adresse manquante).");
      }
    } catch (e) {
      setRecapEnvoiEtat("erreur");
      setRecapMessage(e instanceof Error ? e.message : "L'envoi du récap a échoué.");
    }
  };

  // Renouvelle le code (l'ancien expiré est invalidé) et renvoie l'invitation, pour toutes les
  // fiches dont le code a expiré — d'un seul clic.
  const renvoyerCodesExpires = async () => {
    const cibles = codesExpires.filter((i) => i.compte_email);
    if (cibles.length === 0) return;
    setBulkBusy(true);
    setBulkStatus(null);
    let ok = 0;
    let ko = 0;
    for (const i of cibles) {
      if (!i.compte_email) continue;
      try {
        const reg = await onRegenererCode(i.id);
        if (reg.error) {
          ko += 1;
          continue;
        }
        const envoi = await onInviter(i.compte_email, i.nom);
        if (envoi.error) ko += 1;
        else ok += 1;
      } catch {
        ko += 1;
      }
    }
    setBulkBusy(false);
    if (ok === 0 && ko === 0) {
      setBulkStatus({ ok: false, text: "Aucun code expiré à renouveler." });
      return;
    }
    if (ko === 0) {
      setBulkStatus({ ok: true, text: `${ok} code${ok > 1 ? "s" : ""} renouvelé${ok > 1 ? "s" : ""} et renvoyé${ok > 1 ? "s" : ""}.` });
    } else if (ok === 0) {
      setBulkStatus({ ok: false, text: `Renvoi impossible (${ko} échec${ko > 1 ? "s" : ""}).` });
    } else {
      setBulkStatus({ ok: false, text: `${ok} renvoyé${ok > 1 ? "s" : ""}, ${ko} en échec.` });
    }
  };

  return (
    <>
      <Modal
        title="Intervenants de l'entreprise"
        subtitle="Ajoutez les personnes que vous pouvez affecter à vos interventions."
        onClose={onClose}
        wide
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={ouvrirCreation}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap"
            >
              <i className="ri-user-add-line"></i> Ajouter un intervenant
            </button>
          </>
        }
      >
        {intervenants.length === 0 ? (
          <div className="flex flex-col items-center text-center px-6 py-10 rounded-lg bg-background-100 border border-background-200">
            <span className="w-14 h-14 flex items-center justify-center rounded-full bg-primary-100 text-primary-700 text-2xl">
              <i className="ri-team-line"></i>
            </span>
            <p className="mt-4 text-sm text-foreground-600 max-w-sm">
              Vous travaillez seul ? Aucun intervenant n'est nécessaire. Vous avez une équipe ? Ajoutez
              chacun pour répartir les interventions du planning.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Test du récap des invitations : aperçu + envoi immédiat, sans attendre le jour/heure. */}
            <div className="flex flex-col gap-2 rounded-lg bg-background-50 border border-background-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
                    <i className="ri-mail-star-line"></i>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground-950">Récap des invitations</p>
                    <p className="text-[11px] text-foreground-500">
                      Testez l'email hebdomadaire sans attendre : aperçu, ou envoi immédiat à votre adresse.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => { void ouvrirApercuRecap(); }}
                    disabled={recapApercuEtat === "chargement" || !user}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <i className={recapApercuEtat === "chargement" ? "ri-loader-4-line animate-spin" : "ri-eye-line"}></i>
                    Aperçu
                  </button>
                  <button
                    type="button"
                    onClick={() => { void envoyerRecapMaintenant(); }}
                    disabled={recapEnvoiEtat === "chargement" || !user}
                    title="Envoyer tout de suite le récap des invitations à votre adresse"
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-900 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <i className={recapEnvoiEtat === "chargement" ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}></i>
                    {recapEnvoiEtat === "chargement" ? "Envoi…" : "Envoyer le récap maintenant"}
                  </button>
                </div>
              </div>
              {recapMessage && (
                <p
                  className={`text-[11px] inline-flex items-center gap-1 ${
                    recapEnvoiEtat === "succes" ? "text-secondary-700" : "text-red-600"
                  }`}
                >
                  <i className={recapEnvoiEtat === "succes" ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
                  {recapMessage}
                </p>
              )}
              {recapApercuOuvert && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">
                      <i className="ri-mail-line"></i> Aperçu de l'email
                    </span>
                    <button
                      type="button"
                      onClick={() => setRecapApercuOuvert(false)}
                      aria-label="Fermer l'aperçu"
                      className="w-6 h-6 flex items-center justify-center rounded-md text-foreground-400 hover:text-foreground-700 hover:bg-background-200 cursor-pointer transition-colors"
                    >
                      <i className="ri-close-line"></i>
                    </button>
                  </div>
                  {recapApercuEtat === "chargement" && (
                    <p className="text-[11px] text-foreground-500 flex items-center gap-1.5 py-3">
                      <i className="ri-loader-4-line animate-spin"></i> Construction de l'aperçu…
                    </p>
                  )}
                  {recapApercuEtat === "erreur" && (
                    <p className="text-[11px] text-red-600 flex items-center gap-1.5 py-3">
                      <i className="ri-error-warning-line"></i> L'aperçu n'a pas pu être généré.
                    </p>
                  )}
                  {recapApercuEtat === "succes" && recapApercuHtml && (
                    <iframe
                      title="Aperçu du récap des invitations d'intervenants"
                      srcDoc={recapApercuHtml}
                      sandbox=""
                      className="w-full h-96 rounded-md border border-background-200 bg-background-50"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Alerte : fiches dont le code d'invitation a expiré — à relancer avec un code neuf. */}
            {codesExpires.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg bg-red-50 border border-red-200 p-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-red-500 text-background-50">
                    <i className="ri-timer-flash-line"></i>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground-950">
                      {codesExpires.length} code{codesExpires.length > 1 ? "s" : ""} expiré{codesExpires.length > 1 ? "s" : ""} à renvoyer
                    </p>
                    <p className="text-[11px] text-foreground-600 truncate">
                      {codesExpires.map((i) => i.nom).join(", ")} · le code ne permet plus de rattacher de compte.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={renvoyerCodesExpires}
                  disabled={bulkBusy || codesExpiresAvecEmail.length === 0}
                  title={
                    codesExpiresAvecEmail.length === 0
                      ? "Renseignez un email sur ces fiches pour renvoyer un code neuf"
                      : "Régénérer un code neuf (l'ancien expiré est invalidé) et renvoyer l'invitation, pour toutes ces fiches"
                  }
                  className="self-start sm:self-auto inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-red-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className={bulkBusy ? "ri-loader-4-line animate-spin" : "ri-refresh-line"}></i>
                  Renvoyer un code neuf aux {codesExpiresAvecEmail.length}
                </button>
              </div>
            )}

            {/* Compteur global : d'un coup d'œil, combien de personnes restent à inviter. */}
            <div
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                invitationsAEnvoyer > 0 ? "bg-primary-50 border-primary-200" : "bg-background-100 border-background-200"
              }`}
            >
              <span
                className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-full ${
                  invitationsAEnvoyer > 0 ? "bg-primary-500 text-background-50" : "bg-background-200 text-foreground-400"
                }`}
              >
                <i className={invitationsAEnvoyer > 0 ? "ri-mail-send-line" : "ri-mail-check-line"}></i>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground-950">
                  {invitationsAEnvoyer} invitation{invitationsAEnvoyer > 1 ? "s" : ""} à envoyer
                </p>
                <p className="text-[11px] text-foreground-600">
                  {invitationsAEnvoyer === 0
                    ? "Toutes les personnes disposant d'un email ont déjà été invitées."
                    : "Personnes jamais invitées disposant d'un email de compte."}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {rattaches > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-secondary-100 border border-secondary-200 text-secondary-800 text-[11px] font-semibold whitespace-nowrap">
                    <i className="ri-user-follow-line"></i>
                    {rattaches} compte{rattaches > 1 ? "s" : ""} rattaché{rattaches > 1 ? "s" : ""}
                  </span>
                )}
                {invitationsAEnvoyer > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background-50 border border-primary-200 text-primary-700 text-[11px] font-semibold whitespace-nowrap">
                    <i className="ri-team-line"></i>
                    {actifs.length} actif{actifs.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-foreground-500 inline-flex items-center gap-1">
                <i className="ri-filter-3-line"></i> Afficher
              </span>
              <button
                type="button"
                onClick={() => setFiltre("tous")}
                aria-pressed={filtre === "tous"}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  filtre === "tous"
                    ? "bg-foreground-900 text-background-50"
                    : "bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-200"
                }`}
              >
                <i className="ri-team-line"></i>
                Tous
                <span className={`inline-flex items-center justify-center min-w-[18px] h-5 px-1 rounded-full text-[10px] font-bold ${filtre === "tous" ? "bg-background-50/25" : "bg-background-200 text-foreground-500"}`}>
                  {actifs.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFiltre("invites")}
                aria-pressed={filtre === "invites"}
                title="N'afficher que les personnes dont l'invitation est partie mais qui n'ont pas encore créé leur compte"
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  filtre === "invites"
                    ? "bg-accent-500 text-background-50"
                    : "bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-200"
                }`}
              >
                <i className="ri-mail-check-line"></i>
                Invités sans compte
                <span className={`inline-flex items-center justify-center min-w-[18px] h-5 px-1 rounded-full text-[10px] font-bold ${filtre === "invites" ? "bg-background-50/25" : "bg-background-200 text-foreground-500"}`}>
                  {invitesSansCompte.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFiltre("relance")}
                aria-pressed={filtre === "relance"}
                title="N'afficher que les intervenants à rappeler (jamais invités ou invités il y a longtemps)"
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  filtre === "relance"
                    ? "bg-foreground-900 text-background-50"
                    : "bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-200"
                }`}
              >
                <i className="ri-alarm-warning-line"></i>
                À relancer
                <span className={`inline-flex items-center justify-center min-w-[18px] h-5 px-1 rounded-full text-[10px] font-bold ${filtre === "relance" ? "bg-background-50/25" : "bg-background-200 text-foreground-500"}`}>
                  {aRelancer.length}
                </span>
              </button>
              {rattaches > 0 && (
                <button
                  type="button"
                  onClick={() => setMasquerRattaches((v) => !v)}
                  aria-pressed={masquerRattaches}
                  title="Masquer les fiches dont le compte est déjà rattaché, pour n'afficher que celles à traiter"
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    masquerRattaches
                      ? "bg-secondary-500 text-background-50"
                      : "bg-secondary-100 border border-secondary-200 text-secondary-900 hover:bg-secondary-200"
                  }`}
                >
                  <i className={masquerRattaches ? "ri-eye-off-line" : "ri-eye-line"}></i>
                  Masquer les comptes rattachés
                  <span className={`inline-flex items-center justify-center min-w-[18px] h-5 px-1 rounded-full text-[10px] font-bold ${masquerRattaches ? "bg-background-50/25" : "bg-secondary-200 text-secondary-800"}`}>
                    {rattaches}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setTri((t) => (t === "etat" ? "defaut" : "etat"))}
                aria-pressed={tri === "etat"}
                title="Trier la liste par état d'invitation : jamais invité, puis invité, puis compte rattaché"
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  tri === "etat"
                    ? "bg-foreground-900 text-background-50"
                    : "bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-200"
                }`}
              >
                <i className={tri === "etat" ? "ri-sort-desc" : "ri-sort-asc"}></i>
                {tri === "etat" ? "Tri : par état" : "Trier par état"}
              </button>
            </div>

            {invitesSansCompte.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg bg-accent-100 border border-accent-200 p-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50">
                    <i className="ri-mail-check-line"></i>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground-950">
                      {invitesSansCompte.length} personne{invitesSansCompte.length > 1 ? "s" : ""} invitée{invitesSansCompte.length > 1 ? "s" : ""} sans compte créé
                    </p>
                    <p className="text-[11px] text-foreground-600 truncate">
                      {invitesSansCompte.map((i) => i.nom).join(", ")} · l'invitation est partie mais le compte n'a pas encore été créé.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={relancerTousInvites}
                  disabled={bulkBusy}
                  className="self-start sm:self-auto inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className={bulkBusy ? "ri-loader-4-line animate-spin" : "ri-refresh-line"}></i>
                  Relancer les {invitesSansCompte.length}
                </button>
              </div>
            )}

            {aRelancer.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg bg-accent-100 border border-accent-200 p-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50">
                    <i className="ri-alarm-warning-line"></i>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground-950">
                      {aRelancer.length} intervenant{aRelancer.length > 1 ? "s" : ""} à relancer
                    </p>
                    <p className="text-[11px] text-foreground-600 truncate">
                      {aRelancer.map((i) => i.nom).join(", ")} · invitation jamais envoyée ou déjà ancienne.
                    </p>
                  </div>
                </div>
                {jamaisInvites.length > 0 && (
                  <button
                    type="button"
                    onClick={inviterTous}
                    disabled={bulkBusy}
                    className="self-start sm:self-auto inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className={bulkBusy ? "ri-loader-4-line animate-spin" : "ri-mail-send-line"}></i>
                    Inviter les {jamaisInvites.length} jamais invité{jamaisInvites.length > 1 ? "s" : ""}
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {affiches.length === 0 ? (
                <p className="text-sm text-foreground-500 px-1 py-4 flex items-center gap-2">
                  <i className="ri-checkbox-circle-line text-secondary-600"></i>
                  {masquerRattaches && filtre === "tous"
                    ? "Toutes les fiches visibles ont déjà un compte rattaché. Désactivez le masquage pour les revoir."
                    : filtre === "invites"
                      ? "Aucune personne invitée en attente de compte. Tout est à jour."
                      : "Aucun intervenant à relancer. Tout est à jour."}
                </p>
              ) : (
                affiches.map((i) => {
                  // Fiche « invitée mais sans compte » : invitation envoyée, compte pas encore créé.
                  const inviteSansCompte = !i.compte_rattache && Boolean(i.compte_email) && Boolean(i.invitation_envoyee_le);
                  // Validité du code d'invitation : expiré, bientôt expiré, ou encore valide.
                  const validite = validiteCodeInvitation(i);
                  // Un compte rattaché l'emporte sur l'état d'invitation : c'est la confirmation
                  // que l'intervenant a bien créé son compte et relié sa fiche.
                  const meta = i.compte_rattache
                    ? {
                        niveau: "recente" as const,
                        label: "Compte rattaché",
                        icon: "ri-user-follow-line",
                        tone: "bg-secondary-100 text-secondary-800",
                        relance: false,
                      }
                    : inviteSansCompte
                      ? {
                          niveau: "recente" as const,
                          label: "Invité · compte à créer",
                          icon: "ri-mail-check-line",
                          tone: "bg-accent-100 text-accent-800",
                          relance: true,
                        }
                      : metaInvitation(i);
                  return (
                    <div
                      key={i.id}
                      className={`flex items-center gap-3 p-3 rounded-md border ${
                        inviteSansCompte
                          ? "bg-accent-50 border-accent-300"
                          : meta.relance
                            ? "bg-background-100 border-accent-300"
                            : "bg-background-100 border-background-200"
                      }`}
                    >
                      <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-background-50 text-sm font-bold" style={{ backgroundColor: couleurIntervenant(i.couleur) }}>
                        {i.nom.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground-900 truncate">{i.nom}</p>
                          <span className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap ${meta.tone}`}>
                            <i className={meta.icon}></i>
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-foreground-500 truncate">
                          {i.metier || "Métier non précisé"}
                          {i.telephone ? ` · ${i.telephone}` : ""}
                        </p>
                        {i.compte_email && (
                          <p className="text-[10px] text-foreground-400 truncate inline-flex items-center gap-1">
                            <i className="ri-history-line"></i>
                            {i.invitation_envoyee_le
                              ? `Invitation : ${formatDateHeureCourte(i.invitation_envoyee_le)}`
                              : "Pas encore invitée"}
                          </p>
                        )}
                        {i.code_invitation && !i.compte_rattache && (
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-foreground-400 inline-flex items-center gap-1">
                              <i className="ri-key-2-line"></i> Code :
                            </span>
                            <span className="text-[11px] font-bold tracking-wider text-foreground-700 bg-background-50 border border-background-200 rounded px-1.5 py-0.5">
                              {i.code_invitation}
                            </span>
                            {validite.expire ? (
                              <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-red-100 text-red-700 text-[10px] font-bold whitespace-nowrap">
                                <i className="ri-error-warning-line"></i> Code expiré
                              </span>
                            ) : validite.expireBientot ? (
                              <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-accent-100 text-accent-800 text-[10px] font-bold whitespace-nowrap">
                                <i className="ri-timer-line"></i> Expire dans {validite.joursRestants} j
                              </span>
                            ) : validite.joursRestants !== null ? (
                              <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-semibold whitespace-nowrap">
                                <i className="ri-shield-check-line"></i> Valide {validite.joursRestants} j
                              </span>
                            ) : null}
                            <BoutonCopierCode code={i.code_invitation} />
                            <button
                              type="button"
                              onClick={() => setConfirmRegen(i)}
                              disabled={regenId === i.id}
                              title="Régénérer le code (l'ancien est invalidé)"
                              className="inline-flex items-center gap-1 h-6 px-2 rounded bg-background-50 border border-background-300 text-[10px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors disabled:opacity-50"
                            >
                              <i className={regenId === i.id ? "ri-loader-4-line animate-spin" : "ri-refresh-line"}></i>
                              Régénérer
                            </button>
                          </div>
                        )}
                        {regenStatus?.id === i.id && (
                          <p className={`text-[10px] mt-1 inline-flex items-center gap-1 ${regenStatus.ok ? "text-secondary-700" : "text-red-600"}`}>
                            <i className={regenStatus.ok ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
                            {regenStatus.text}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggle(i.id, false)}
                        title="Désactiver"
                        className="w-8 h-8 flex items-center justify-center rounded-md bg-background-50/70 hover:bg-background-50 hover:text-amber-600 cursor-pointer"
                      >
                        <i className="ri-pause-circle-line text-foreground-500"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => ouvrirEdition(i)}
                        title="Modifier"
                        className="w-8 h-8 flex items-center justify-center rounded-md bg-background-50/70 hover:bg-background-50 cursor-pointer"
                      >
                        <i className="ri-pencil-line text-foreground-500"></i>
                      </button>
                      {!i.compte_rattache && (
                        <button
                          type="button"
                          onClick={() => inviter(i)}
                          disabled={!i.compte_email || invitingId === i.id}
                          title={
                            i.compte_email
                              ? i.invitation_envoyee_le
                                ? `Renvoyer l'invitation à ${i.compte_email} (dernier envoi : ${formatDateHeureCourte(i.invitation_envoyee_le)})`
                                : `Envoyer l'invitation à ${i.compte_email}`
                              : "Renseignez d'abord un email de compte sur sa fiche"
                          }
                          className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] font-semibold cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
                            inviteSansCompte
                              ? "bg-accent-500 text-background-50 hover:bg-accent-600"
                              : "bg-secondary-100 text-secondary-900 hover:bg-secondary-200"
                          }`}
                        >
                          <i className={invitingId === i.id ? "ri-loader-4-line animate-spin" : i.invitation_envoyee_le ? "ri-refresh-line" : "ri-mail-send-line"}></i>
                          <span className="hidden md:inline">{i.invitation_envoyee_le ? "Relancer" : "Inviter"}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(i)}
                        title="Supprimer"
                        className="w-8 h-8 flex items-center justify-center rounded-md bg-background-50/70 hover:bg-background-50 hover:text-red-600 cursor-pointer"
                      >
                        <i className="ri-delete-bin-line text-foreground-500"></i>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {inactifs.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Inactifs ({inactifs.length})</p>
                {inactifs.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 p-3 rounded-md bg-background-100 border border-background-200 opacity-70">
                    <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-background-50 text-sm font-bold" style={{ backgroundColor: couleurIntervenant(i.couleur) }}>
                      {i.nom.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground-700 truncate">{i.nom}</p>
                      <p className="text-[11px] text-foreground-500 truncate">{i.metier || "Métier non précisé"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggle(i.id, true)}
                      title="Réactiver"
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-900 text-xs font-semibold hover:bg-secondary-200 cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-play-circle-line"></i> Réactiver
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(i)}
                      title="Supprimer"
                      className="w-8 h-8 flex items-center justify-center rounded-md bg-background-50/70 hover:bg-background-50 hover:text-red-600 cursor-pointer"
                    >
                      <i className="ri-delete-bin-line text-foreground-500"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {inviteStatus && (
          <p className={`text-[11px] inline-flex items-center gap-1 ${inviteStatus.ok ? "text-secondary-700" : "text-red-600"}`}>
            <i className={inviteStatus.ok ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
            {inviteStatus.text}
          </p>
        )}

        {bulkStatus && (
          <p className={`text-[11px] inline-flex items-center gap-1 ${bulkStatus.ok ? "text-secondary-700" : "text-red-600"}`}>
            <i className={bulkStatus.ok ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
            {bulkStatus.text}
          </p>
        )}
      </Modal>

      {formOpen && (
        <IntervenantFormModal intervenant={editing} busy={busy} onClose={() => setFormOpen(false)} onSubmit={handleSubmit} onInviter={onInviter} />
      )}

      {confirmRegen && (
        <Modal title="Régénérer le code d'invitation ?" onClose={() => setConfirmRegen(null)}>
          <p className="text-sm text-foreground-600">
            Un <strong className="text-foreground-900">nouveau code</strong> sera généré pour{" "}
            <strong className="text-foreground-900">{confirmRegen.nom}</strong>. L'ancien code sera{" "}
            <strong className="text-foreground-900">immédiatement invalidé</strong> : il ne permettra plus de rattacher
            de compte.{" "}
            {confirmRegen.compte_email ? (
              <>
                L'invitation contenant le nouveau code sera{" "}
                <strong className="text-foreground-900">envoyée automatiquement</strong> à{" "}
                <strong className="text-foreground-900">{confirmRegen.compte_email}</strong> — plus besoin de relancer à
                la main.
              </>
            ) : (
              <>
                Aucune adresse email n'est renseignée : complétez-la sur sa fiche pour pouvoir transmettre le code.
              </>
            )}
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => setConfirmRegen(null)}
              className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                regenerer(confirmRegen);
                setConfirmRegen(null);
              }}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap"
            >
              <i className="ri-refresh-line"></i>
              Régénérer et envoyer
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Supprimer cet intervenant ?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-foreground-600">
            <strong className="text-foreground-900">{confirmDelete.nom}</strong> sera retiré de l'équipe. Ses interventions
            existantes sont conservées : elles passeront simplement en « non affecté ».
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete(confirmDelete.id);
                setConfirmDelete(null);
              }}
              className="h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap"
            >
              Supprimer
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}