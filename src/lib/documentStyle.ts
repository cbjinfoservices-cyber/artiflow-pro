import type { PdfDocumentStyle } from "@/lib/pdf";

/**
 * Apparence personnalisable des documents PDF (devis & factures).
 *
 * Trois réglages, mémorisés sur le profil de l'artisan :
 * 1. la couleur d'accent des documents (orange « cuivre » par défaut) ;
 * 2. l'affichage ou non du logo de l'entreprise en en-tête ;
 * 3. les coordonnées de paiement (IBAN / BIC, conditions de règlement) affichées sur les factures.
 */

/** Couleur d'accent par défaut (identique au orange historique des documents). */
export const ACCENT_DEFAUT = "#C4783A";

/**
 * Couleurs d'accent proposées. Volontairement chaleureuses et sobres
 * (aucun bleu ni violet), pour rester adaptées aux documents d'un artisan du bâtiment.
 */
export const ACCENTS_DOCUMENTS: { value: string; label: string }[] = [
  { value: "#C4783A", label: "Cuivre" },
  { value: "#B4502F", label: "Terracotta" },
  { value: "#A9852F", label: "Or vieilli" },
  { value: "#3F6B4A", label: "Vert forêt" },
  { value: "#7A2E3A", label: "Bordeaux" },
  { value: "#3A3A3A", label: "Anthracite" },
];

const ACCENT_PAR_DEFAUT_RGB: [number, number, number] = [196, 120, 58];

/** Convertit une couleur hexadécimale (« #C4783A ») en triplet RGB, avec repli sur le cuivre. */
export function hexToRgb(hex: string | null | undefined): [number, number, number] {
  if (!hex) return ACCENT_PAR_DEFAUT_RGB;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return ACCENT_PAR_DEFAUT_RGB;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Partie du profil utile au rendu des documents. */
export interface ProfilApparence {
  doc_couleur?: string | null;
  doc_afficher_logo?: boolean | null;
  doc_paiement?: string | null;
  /** Message de pied de page libre affiché sur les documents (devis & factures). */
  doc_pied_page?: string | null;
  /** Modèle de mise en page des documents : « standard » (défaut) ou « compact ». */
  doc_modele?: string | null;
}

/** Construit le style d'apparence des documents à partir du profil de l'artisan. */
export function styleDocumentsDepuisProfil(profile: ProfilApparence | null | undefined): PdfDocumentStyle {
  return {
    accent: hexToRgb(profile?.doc_couleur),
    afficherLogo: profile?.doc_afficher_logo !== false,
    paiement: profile?.doc_paiement?.trim() ? profile.doc_paiement : null,
    piedPage: profile?.doc_pied_page?.trim() ? profile.doc_pied_page : null,
    modeleDocument: profile?.doc_modele === "compact" ? "compact" : "standard",
  };
}