import { supabase } from "@/lib/supabase";

/** Un intervenant de l'entreprise : un membre de l'équipe qu'on peut affecter à un créneau. */
export interface Intervenant {
  id: number;
  nom: string;
  /** Clé de couleur d'identification (voir COULEURS_INTERVENANT), ou null. */
  couleur: string | null;
  /** Métier / rôle, ex. « électricien », « aide ». */
  metier: string | null;
  telephone: string | null;
  /** Un intervenant inactif reste enregistré mais est masqué des sélecteurs. */
  actif: boolean;
  created_at: string;
}

/** Champs modifiables d'un intervenant. */
export interface IntervenantPayload {
  nom: string;
  couleur: string | null;
  metier: string | null;
  telephone: string | null;
  actif: boolean;
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

/** Liste les intervenants de l'entreprise (RLS : uniquement ceux de l'artisan connecté). */
export async function fetchIntervenants(): Promise<Intervenant[]> {
  const { data, error } = await supabase
    .from("intervenants")
    .select("id, nom, couleur, metier, telephone, actif, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    nom: String(row.nom ?? ""),
    couleur: row.couleur === null || row.couleur === undefined ? null : String(row.couleur),
    metier: row.metier === null || row.metier === undefined ? null : String(row.metier),
    telephone: row.telephone === null || row.telephone === undefined ? null : String(row.telephone),
    actif: Boolean(row.actif),
    created_at: String(row.created_at ?? ""),
  }));
}

/** Ajoute un intervenant à l'entreprise. */
export async function createIntervenant(userId: string, payload: IntervenantPayload): Promise<void> {
  const { error } = await supabase.from("intervenants").insert({
    user_id: userId,
    nom: payload.nom.trim(),
    couleur: payload.couleur,
    metier: payload.metier?.trim() || null,
    telephone: payload.telephone?.trim() || null,
    actif: payload.actif,
  });
  if (error) throw error;
}

/** Met à jour la fiche d'un intervenant. */
export async function updateIntervenant(id: number, payload: IntervenantPayload): Promise<void> {
  const { error } = await supabase
    .from("intervenants")
    .update({
      nom: payload.nom.trim(),
      couleur: payload.couleur,
      metier: payload.metier?.trim() || null,
      telephone: payload.telephone?.trim() || null,
      actif: payload.actif,
    })
    .eq("id", id);
  if (error) throw error;
}

/** Active ou désactive un intervenant (sans le supprimer ni toucher à ses créneaux). */
export async function setIntervenantActif(id: number, actif: boolean): Promise<void> {
  const { error } = await supabase.from("intervenants").update({ actif }).eq("id", id);
  if (error) throw error;
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