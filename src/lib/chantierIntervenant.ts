import { supabase } from "@/lib/supabase";

/** Ce qu'un intervenant voit d'un chantier : uniquement l'utile sur le terrain (aucun montant). */
export interface ChantierIntervenant {
  id: number;
  libelle: string | null;
  adresse: string | null;
  statut: string | null;
  note: string | null;
  clientNom: string | null;
  clientContact: string | null;
  clientTelephone: string | null;
  clientAdresse: string | null;
  etapes: { libelle: string; fait: boolean }[];
}

/**
 * Détail d'un chantier pour l'intervenant connecté (fonction Backend `chantier_pour_intervenant`,
 * qui vérifie l'affectation). Renvoie null si le chantier n'est pas accessible ou si la fonction
 * n'est pas encore installée : l'écran se rabat alors sur les informations de l'intervention.
 */
export async function fetchChantierIntervenant(chantierId: number): Promise<ChantierIntervenant | null> {
  const { data, error } = await supabase.rpc("chantier_pour_intervenant", { p_chantier_id: chantierId });
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as Record<string, unknown>;
  const texte = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const etapes = Array.isArray(row.etapes)
    ? (row.etapes as { libelle?: unknown; fait?: unknown }[])
        .filter((e) => typeof e.libelle === "string")
        .map((e) => ({ libelle: String(e.libelle), fait: e.fait === true }))
    : [];
  return {
    id: Number(row.id),
    libelle: texte(row.libelle),
    adresse: texte(row.adresse),
    statut: texte(row.statut),
    note: texte(row.note),
    clientNom: texte(row.client_nom),
    clientContact: texte(row.client_contact),
    clientTelephone: texte(row.client_telephone),
    clientAdresse: texte(row.client_adresse),
    etapes,
  };
}

/** Lien d'itinéraire (Google Maps, ouvert dans l'application Maps du téléphone). */
export function lienItineraire(adresse: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}`;
}
