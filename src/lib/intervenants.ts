import { supabase } from "@/lib/supabase";
import { publicBaseUrl } from "@/lib/signature";
import { joursDepuis } from "@/lib/dates";

/** Un intervenant de l'entreprise : un membre de l'équipe qu'on peut affecter à un créneau. */
export interface Intervenant {
  id: number;
  nom: string;
  /** Clé de couleur d'identification (voir COULEURS_INTERVENANT), ou null. */
  couleur: string | null;
  /** Métier / rôle, ex. « électricien », « aide ». */
  metier: string | null;
  telephone: string | null;
  /** Adresse email du compte personnel de l'intervenant (accès à son planning), ou null. */
  compte_email: string | null;
  /** Un intervenant inactif reste enregistré mais est masqué des sélecteurs. */
  actif: boolean;
  /** Date et heure du dernier envoi d'invitation à cette adresse (ISO), ou null si jamais invité. */
  invitation_envoyee_le: string | null;
  /** Code d'invitation à communiquer à l'intervenant (relie son compte à sa fiche), ou null. */
  code_invitation?: string | null;
  /** Date et heure d'expiration du code d'invitation (ISO), ou null s'il n'expire pas. */
  code_invitation_expire_le?: string | null;
  /** Un compte réel a été créé avec l'email de la fiche : le rattachement est effectif. */
  compte_rattache?: boolean;
  created_at: string;
}

/** Champs modifiables d'un intervenant. */
export interface IntervenantPayload {
  nom: string;
  couleur: string | null;
  metier: string | null;
  telephone: string | null;
  /** Adresse email du compte personnel de l'intervenant (accès à son planning), ou null. */
  compte_email: string | null;
  actif: boolean;
}

/**
 * Génère un code d'invitation court et lisible (8 caractères, sans caractères ambigus
 * comme O/0 ou I/1). Ce code relie le compte d'un intervenant à sa fiche : il est envoyé
 * par email et doit être saisi sur l'écran « Rattacher mon compte » pour confirmer.
 */
const ALPHABET_CODE_INVITATION = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function genererCodeInvitation(): string {
  const octets = new Uint8Array(8);
  crypto.getRandomValues(octets);
  let code = "";
  for (let i = 0; i < octets.length; i += 1) {
    code += ALPHABET_CODE_INVITATION[octets[i] % ALPHABET_CODE_INVITATION.length];
  }
  return code;
}

/**
 * Palette d'identification des intervenants : des teintes chaudes et naturelles, bien
 * distinctes entre elles, pour repérer d'un coup d'œil qui fait quoi dans le planning.
 * Ces couleurs servent uniquement de repère d'identité (pastille + liseré), pas de thème.
 */
export const COULEURS_INTERVENANT: { cle: string; label: string; hex: string }[] = [
  { cle: "ambre", label: "Ambre", hex: "#d97706" },
  { cle: "terracotta", label: "Terracotta", hex: "#c2410c" },
  { cle: "brique", label: "Brique", hex: "#b91c1c" },
  { cle: "olive", label: "Olive", hex: "#4d7c0f" },
  { cle: "emeraude", label: "Émeraude", hex: "#047857" },
  { cle: "ardoise", label: "Ardoise", hex: "#475569" },
];

const COULEUR_DEFAUT = "#78716c";

/** Renvoie le code couleur (hex) associé à une clé de palette, ou une teinte neutre à défaut. */
export function couleurIntervenant(cle: string | null | undefined): string {
  return COULEURS_INTERVENANT.find((c) => c.cle === cle)?.hex ?? COULEUR_DEFAUT;
}

/** Délai (en jours) au-delà duquel une invitation envoyée est jugée « ancienne » et à relancer. */
export const INVITATION_ANCIENNE_JOURS = 14;

/** Niveau d'avancement de l'invitation d'un intervenant à créer son compte. */
export type NiveauInvitation = "sans-email" | "jamais" | "ancienne" | "recente";

/** Repère visuel d'invitation : niveau, libellé court, icône, teinte et besoin de relance. */
export interface InvitationMeta {
  niveau: NiveauInvitation;
  /** Libellé court affiché en pastille dans la liste des intervenants. */
  label: string;
  icon: string;
  tone: string;
  /** Faut-il suggérer une relance d'un coup d'œil ? */
  relance: boolean;
}

/**
 * Classe l'état d'invitation d'un intervenant pour l'affichage :
 * - jamais invité (ou email manquant) → à relancer ;
 * - invité il y a longtemps (au-delà du délai) → à relancer ;
 * - invité récemment → rien à faire.
 */
export function metaInvitation(i: {
  compte_email: string | null;
  invitation_envoyee_le: string | null;
}): InvitationMeta {
  if (!i.compte_email) {
    return {
      niveau: "sans-email",
      label: "Email manquant",
      icon: "ri-mail-close-line",
      tone: "bg-background-200 text-foreground-500",
      relance: false,
    };
  }
  if (!i.invitation_envoyee_le) {
    return {
      niveau: "jamais",
      label: "Jamais invité",
      icon: "ri-mail-add-line",
      tone: "bg-accent-100 text-accent-800",
      relance: true,
    };
  }
  const jours = joursDepuis(i.invitation_envoyee_le);
  if (jours >= INVITATION_ANCIENNE_JOURS) {
    return {
      niveau: "ancienne",
      label: `Invité il y a ${jours} j`,
      icon: "ri-time-line",
      tone: "bg-accent-100 text-accent-800",
      relance: true,
    };
  }
  return {
    niveau: "recente",
    label: "Invitation récente",
    icon: "ri-checkbox-circle-line",
    tone: "bg-secondary-100 text-secondary-800",
    relance: false,
  };
}

/** Durée de validité (en jours) d'un code d'invitation après son envoi. */
export const DUREE_CODE_INVITATION_JOURS = 7;

/** Date d'expiration (ISO) d'un code d'invitation créé maintenant (ou à partir d'une date). */
export function expirationCodeInvitation(depuis: Date = new Date()): string {
  return new Date(depuis.getTime() + DUREE_CODE_INVITATION_JOURS * 86_400_000).toISOString();
}

/** État de validité du code d'invitation d'une fiche (pour l'affichage et la relance). */
export interface ValiditeCodeInvitation {
  /** Vrai si le code existe et que sa date de validité est dépassée. */
  expire: boolean;
  /** Vrai si le code existe et expire très bientôt (dans 2 jours ou moins). */
  expireBientot: boolean;
  /** Nombre de jours restants avant expiration (négatif si déjà expiré), ou null sans date. */
  joursRestants: number | null;
}

/**
 * Indique si le code d'invitation d'une fiche est encore valide. Un code sans date
 * d'expiration est considéré comme non expirant (rétro-compatibilité avec les fiches
 * créées avant l'ajout de l'expiration).
 */
export function validiteCodeInvitation(i: {
  code_invitation?: string | null;
  code_invitation_expire_le?: string | null;
}): ValiditeCodeInvitation {
  if (!i.code_invitation || !i.code_invitation_expire_le) {
    return { expire: false, expireBientot: false, joursRestants: null };
  }
  const t = new Date(i.code_invitation_expire_le).getTime();
  if (!Number.isFinite(t)) return { expire: false, expireBientot: false, joursRestants: null };
  const joursRestants = Math.ceil((t - Date.now()) / 86_400_000);
  return {
    expire: joursRestants < 0,
    expireBientot: joursRestants >= 0 && joursRestants <= 2,
    joursRestants,
  };
}

/** Liste les intervenants de l'entreprise (RLS : uniquement ceux de l'artisan connecté). */
export async function fetchIntervenants(): Promise<Intervenant[]> {
  const { data, error } = await supabase
    .from("intervenants")
    .select("id, nom, couleur, metier, telephone, compte_email, actif, invitation_envoyee_le, code_invitation, code_invitation_expire_le, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    nom: String(row.nom ?? ""),
    couleur: row.couleur === null || row.couleur === undefined ? null : String(row.couleur),
    metier: row.metier === null || row.metier === undefined ? null : String(row.metier),
    telephone: row.telephone === null || row.telephone === undefined ? null : String(row.telephone),
    compte_email: row.compte_email === null || row.compte_email === undefined ? null : String(row.compte_email),
    actif: Boolean(row.actif),
    invitation_envoyee_le:
      row.invitation_envoyee_le === null || row.invitation_envoyee_le === undefined
        ? null
        : String(row.invitation_envoyee_le),
    code_invitation:
      row.code_invitation === null || row.code_invitation === undefined ? null : String(row.code_invitation),
    code_invitation_expire_le:
      row.code_invitation_expire_le === null || row.code_invitation_expire_le === undefined
        ? null
        : String(row.code_invitation_expire_le),
    compte_rattache: false,
    created_at: String(row.created_at ?? ""),
  }));
}

/** Ajoute un intervenant à l'entreprise. */
export async function createIntervenant(userId: string, payload: IntervenantPayload): Promise<void> {
  const email = payload.compte_email?.trim().toLowerCase() || null;
  // Un code d'invitation est généré dès qu'un email de compte est renseigné : il servira
  // à confirmer le rattachement si l'inscription se fait avec une autre adresse. Il porte
  // une date d'expiration pour qu'un code oublié/divulgué ne reste pas utilisable trop longtemps.
  const code = email ? genererCodeInvitation() : null;
  const { error } = await supabase.from("intervenants").insert({
    user_id: userId,
    nom: payload.nom.trim(),
    couleur: payload.couleur,
    metier: payload.metier?.trim() || null,
    telephone: payload.telephone?.trim() || null,
    compte_email: email,
    code_invitation: code,
    code_invitation_expire_le: code ? expirationCodeInvitation() : null,
    actif: payload.actif,
  });
  if (error) throw error;
}

/** Met à jour la fiche d'un intervenant. */
export async function updateIntervenant(id: number, payload: IntervenantPayload): Promise<void> {
  const email = payload.compte_email?.trim().toLowerCase() || null;

  // On conserve le code d'invitation existant ; on n'en crée un que si la fiche devient
  // joignable par email sans en avoir encore. Cela évite d'invalider un code déjà envoyé.
  let code: string | null = null;
  const { data: existante } = await supabase
    .from("intervenants")
    .select("code_invitation")
    .eq("id", id)
    .maybeSingle();
  const codeExistant = (existante as { code_invitation?: unknown } | null)?.code_invitation;
  if (codeExistant != null) code = String(codeExistant);
  if (!code && email) code = genererCodeInvitation();

  const patch: Record<string, unknown> = {
    nom: payload.nom.trim(),
    couleur: payload.couleur,
    metier: payload.metier?.trim() || null,
    telephone: payload.telephone?.trim() || null,
    compte_email: email,
    code_invitation: code,
    actif: payload.actif,
  };
  // Un code tout juste créé reçoit sa propre date d'expiration ; on ne touche pas à celle
  // d'un code existant (déjà envoyé) pour ne pas l'invalider par surprise.
  if (!codeExistant && code) patch.code_invitation_expire_le = expirationCodeInvitation();

  const { error } = await supabase.from("intervenants").update(patch).eq("id", id);
  if (error) throw error;
}

/** Active ou désactive un intervenant (sans le supprimer ni toucher à ses créneaux). */
export async function setIntervenantActif(id: number, actif: boolean): Promise<void> {
  const { error } = await supabase.from("intervenants").update({ actif }).eq("id", id);
  if (error) throw error;
}

/**
 * Régénère le code d'invitation d'une fiche : l'ancien code est immédiatement invalidé
 * (il ne permettra plus aucun rattachement). Utile quand l'email d'invitation s'est égaré,
 * qu'il a pu être divulgué, ou que la personne n'a jamais reçu le bon code.
 * Le nouveau code sera inclus lors de la prochaine invitation envoyée. Renvoie le nouveau code.
 */
export async function regenererCodeInvitation(id: number): Promise<string> {
  const code = genererCodeInvitation();
  const { error } = await supabase
    .from("intervenants")
    .update({ code_invitation: code, code_invitation_expire_le: expirationCodeInvitation() })
    .eq("id", id);
  if (error) throw error;
  return code;
}

/** Lien de la page de connexion à envoyer à un intervenant pour qu'il crée son compte. */
export function lienInscriptionIntervenant(): string {
  return `${publicBaseUrl()}/app/auth`;
}

/**
 * Envoie à un intervenant une invitation par email contenant le lien de création de compte
 * et le code d'invitation. L'email part du Backend (Resend) ; l'adresse doit être celle
 * renseignée sur sa fiche. Renvoie le code d'invitation associé à la fiche.
 */
export async function inviterIntervenant(params: {
  nom: string;
  email: string;
}): Promise<{ code: string | null; expire: string | null }> {
  const { data, error } = await supabase.functions.invoke("inviter-intervenant", {
    body: {
      nom: params.nom,
      email: params.email,
      lienInscription: lienInscriptionIntervenant(),
    },
  });
  if (error) throw new Error(error.message);
  const payload = data as { ok?: boolean; error?: string; code?: string | null; expire?: string | null } | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi de l'invitation a échoué.");
  return { code: payload.code ?? null, expire: payload.expire ?? null };
}

/** Supprime un intervenant. Ses créneaux sont conservés, simplement désaffectés. */
export async function deleteIntervenant(id: number): Promise<void> {
  const { error } = await supabase.from("intervenants").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Réaffecte un créneau de planning à un autre intervenant (ou le désaffecte si
 * `intervenantId` est null). Utilisé par la réaffectation en un clic de la vue Équipe.
 */
export async function reassignerCreneau(creneauId: number, intervenantId: number | null): Promise<void> {
  const { error } = await supabase
    .from("planning_creneaux")
    .update({ intervenant_id: intervenantId })
    .eq("id", creneauId);
  if (error) throw error;
}

/**
 * Réaffecte plusieurs créneaux d'un seul geste à un même intervenant (ou les désaffecte
 * tous si `intervenantId` est null). Utilisé par la réaffectation en lot de la vue Équipe.
 */
export async function reassignerCreneauxEnLot(
  creneauIds: number[],
  intervenantId: number | null,
): Promise<void> {
  if (creneauIds.length === 0) return;
  const { error } = await supabase
    .from("planning_creneaux")
    .update({ intervenant_id: intervenantId })
    .in("id", creneauIds);
  if (error) throw error;
}

/** Champs qu'un responsable peut ajuster depuis le planning. */
export interface CreneauEdition {
  date?: string;
  heure?: string;
  libelle?: string;
  ville?: string | null;
  statut?: string;
  intervenant_id?: number | null;
  chantier_id?: number | null;
  note?: string | null;
}

/**
 * Modifie une intervention du planning (date, heure, intitulé, statut, intervenant…)
 * et trace la modification (date + auteur) pour le bandeau « changements récents ».
 * Utilisé par l'édition rapide au clic dans la vue Équipe.
 */
export async function majCreneauPlanning(
  creneauId: number,
  patch: CreneauEdition,
  updatedBy: string,
): Promise<void> {
  const row: Record<string, unknown> = {
    ...patch,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };
  if (typeof patch.ville === "string") row.ville = patch.ville.trim() || null;
  if (typeof patch.note === "string") row.note = patch.note.trim() || null;
  const { error } = await supabase.from("planning_creneaux").update(row).eq("id", creneauId);
  if (error) throw error;
}

/**
 * Déplace une intervention vers un autre jour et/ou un autre intervenant.
 * C'est l'action du glisser-déposer dans le planning d'équipe.
 */
export async function deplacerCreneau(
  creneauId: number,
  date: string,
  intervenantId: number | null,
  updatedBy: string,
): Promise<void> {
  await majCreneauPlanning(creneauId, { date, intervenant_id: intervenantId }, updatedBy);
}