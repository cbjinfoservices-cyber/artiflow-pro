export const DEVIS_STATUTS = ["Tous", "Brouillon", "Envoyé", "À relancer", "Accepté", "Signé"] as const;
export const DEVIS_STATUTS_FORM = ["Brouillon", "Envoyé", "À relancer", "Accepté", "Signé"] as const;

export type DevisStatut = (typeof DEVIS_STATUTS_FORM)[number];

const DEVIS_TONE: Record<string, string> = {
  Signé: "accent",
  Accepté: "accent",
  Envoyé: "primary",
  "À relancer": "secondary",
  Brouillon: "secondary",
};

/** Ramène n'importe quelle valeur stockée vers un libellé de statut canonique. */
export function normalizeDevisStatut(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().toLowerCase();
  if (v.includes("sign")) return "Signé";
  if (v.includes("accept")) return "Accepté";
  if (v.includes("relanc")) return "À relancer";
  if (v.includes("envoy")) return "Envoyé";
  return "Brouillon";
}

export function devisStatusTone(statut: string): string {
  return DEVIS_TONE[statut] ?? "secondary";
}

export const CHANTIER_STATUTS = ["Tous", "Planifié", "En cours", "Terminé"] as const;
export const CHANTIER_STATUTS_FORM = ["Planifié", "En cours", "Terminé"] as const;

const CHANTIER_TONE: Record<string, string> = {
  Terminé: "accent",
  "En cours": "primary",
  Planifié: "secondary",
};

export function normalizeChantierStatut(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().toLowerCase();
  if (v.includes("termin") || v.includes("fini") || v.includes("clotur")) return "Terminé";
  if (v.includes("cours")) return "En cours";
  return "Planifié";
}

export function chantierStatusTone(statut: string): string {
  return CHANTIER_TONE[statut] ?? "secondary";
}

export const RELANCE_CANAUX = ["Tous", "Email", "SMS", "WhatsApp"] as const;
export const RELANCE_CANAUX_FORM = ["Email", "SMS", "WhatsApp"] as const;

export function normalizeCanal(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().toLowerCase();
  if (v.includes("sms")) return "SMS";
  if (v.includes("whats")) return "WhatsApp";
  return "Email";
}

export function canalIcon(canal: string): string {
  if (canal === "SMS") return "ri-message-2-line";
  if (canal === "WhatsApp") return "ri-whatsapp-line";
  return "ri-mail-line";
}

/** Une relance est active sauf si son statut indique une mise en pause. */
export function relanceIsActive(raw: string | null | undefined): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return !(v.includes("pause") || v.includes("inactif") || v.includes("désactiv") || v.includes("desactiv"));
}

export const TONE_BADGE: Record<string, string> = {
  primary: "bg-primary-100 text-primary-700",
  accent: "bg-accent-100 text-accent-700",
  secondary: "bg-secondary-100 text-secondary-700",
};

export const FACTURE_STATUTS = ["Toutes", "Émise", "Payée", "En retard"] as const;
export const FACTURE_STATUTS_FORM = ["Émise", "Payée", "En retard"] as const;

const FACTURE_TONE: Record<string, string> = {
  Payée: "accent",
  Émise: "primary",
  "En retard": "secondary",
};

/** Ramène n'importe quelle valeur stockée vers un libellé de statut de facture canonique. */
export function normalizeFactureStatut(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().toLowerCase();
  if (v.includes("pay") || v.includes("règl") || v.includes("regl")) return "Payée";
  if (v.includes("retard") || v.includes("impay") || v.includes("echu") || v.includes("échu")) return "En retard";
  return "Émise";
}

export function factureStatusTone(statut: string): string {
  return FACTURE_TONE[statut] ?? "secondary";
}

/** Un document est un avoir (note de crédit) si son numéro porte le préfixe AV. */
export function factureIsAvoir(numero: string | null | undefined): boolean {
  return (numero ?? "").trim().toUpperCase().startsWith("AV");
}