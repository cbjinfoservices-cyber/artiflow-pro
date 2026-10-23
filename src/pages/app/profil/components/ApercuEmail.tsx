/**
 * Aperçu en direct d'un email client (devis, facture ou relance) dans le profil.
 *
 * Reproduit l'identité visuelle réellement utilisée par les emails envoyés au client :
 * barre d'accent colorée, logo en en-tête et message de pied de page. Reflète les
 * brouillons en cours de saisie (objet / texte) sans rien envoyer.
 */

type TypeEmail = "devis" | "facture" | "relance";

interface ExempleEmail {
  sujet: string;
  corps: string;
  destinataire: string;
  numero: string;
  objet: string;
  montant: string;
  echeance: string;
}

/** Jeu d'exemple réaliste par type d'email (variables recopiées comme dans les vrais envois). */
const EXEMPLES: Record<TypeEmail, ExempleEmail> = {
  devis: {
    sujet: "Votre devis {{numero}} · {{objet}}",
    corps:
      "Bonjour {{client}},\n\nVoici votre devis {{numero}} d'un montant de {{montant}}. Vous pouvez le signer directement en ligne via le bouton ci-dessous.",
    destinataire: "M. Julien Bernard",
    numero: "D-2026-014",
    objet: "Rénovation salle de bain",
    montant: "5 256,00 €",
    echeance: "15/11/2026",
  },
  facture: {
    sujet: "Votre facture {{numero}}",
    corps:
      "Bonjour {{client}},\n\nVeuillez trouver ci-joint votre facture {{numero}} d'un montant de {{montant}}, à régler avant le {{echeance}}.",
    destinataire: "M. Julien Bernard",
    numero: "F-2026-014",
    objet: "Rénovation salle de bain",
    montant: "5 256,00 €",
    echeance: "15/11/2026",
  },
  relance: {
    sujet: "Un mot de {{entreprise}}",
    corps:
      "Bonjour {{client}},\n\nJe me permets de vous recontacter au sujet de notre dossier. N'hésitez pas à revenir vers moi dès que vous le souhaitez.",
    destinataire: "M. Julien Bernard",
    numero: "F-2026-012",
    objet: "Rénovation salle de bain",
    montant: "3 480,00 €",
    echeance: "01/11/2026",
  },
};

/** Remplace les variables {{...}} par les valeurs d'exemple. */
function appliquer(template: string, valeurs: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => valeurs[key.toLowerCase()] ?? "");
}

export default function ApercuEmail({
  type,
  entreprise,
  couleur,
  afficherLogo,
  logoUrl,
  metier,
  telephone,
  sujetDraft,
  corpsDraft,
  piedPage,
}: {
  type: TypeEmail;
  entreprise: string;
  couleur: string;
  afficherLogo: boolean;
  logoUrl: string | null;
  metier: string;
  telephone: string;
  /** Objet en cours de saisie (brouillon), pour un aperçu fidèle avant enregistrement. */
  sujetDraft: string;
  /** Texte en cours de saisie (brouillon), pour un aperçu fidèle avant enregistrement. */
  corpsDraft: string;
  /** Message de pied de page libre. */
  piedPage: string;
}) {
  const ex = EXEMPLES[type];
  const nom = entreprise.trim() || "Mon entreprise";
  const initiales =
    nom
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "AF";

  const valeurs: Record<string, string> = {
    client: ex.destinataire,
    entreprise: nom,
    numero: ex.numero,
    objet: ex.objet,
    montant: ex.montant,
    echeance: ex.echeance,
    lien: "https://artiflow-pro.com/signature-devis/ab12cd34",
  };
  const sujet = appliquer((sujetDraft ?? "").trim() || ex.sujet, valeurs);
  const corps = appliquer((corpsDraft ?? "").trim() || ex.corps, valeurs);
  const piedTrim = (piedPage ?? "").trim();
  const contact = [metier, telephone].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-3">
      {/* Barre « objet » de l'email */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-background-50 border border-background-200">
        <i className="ri-mail-line" style={{ color: couleur }}></i>
        <span className="text-xs text-foreground-500 whitespace-nowrap">Objet :</span>
        <span className="text-xs font-semibold text-foreground-900 truncate">{sujet}</span>
        <span className="ml-auto inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold whitespace-nowrap">
          <i className="ri-eye-line"></i>
          Aperçu
        </span>
      </div>

      <div className="rounded-lg border border-background-200 overflow-hidden bg-background-50">
        {/* Barre d'accent (couleur personnalisable du profil). */}
        <div className="h-1.5" style={{ backgroundColor: couleur }} />

        <div className="p-5">
          {/* En-tête expéditeur : logo + nom + contacts */}
          <div className="flex items-center gap-2.5 pb-4 border-b border-background-200">
            {afficherLogo && logoUrl ? (
              <span className="w-11 h-11 shrink-0 rounded-md bg-background-100 border border-background-200 flex items-center justify-center overflow-hidden">
                <img src={logoUrl} alt="Logo de l'entreprise" className="w-full h-full object-contain" />
              </span>
            ) : afficherLogo ? (
              <span
                className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-[13px] font-heading font-bold text-background-50"
                style={{ backgroundColor: couleur }}
              >
                {initiales}
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="font-heading font-bold text-sm text-foreground-950 truncate">{nom}</p>
              {contact && <p className="text-[11px] text-foreground-500 truncate">{contact}</p>}
            </div>
          </div>

          {/* Corps du message */}
          <div className="pt-4">
            <p className="text-[13px] text-foreground-800">Bonjour {ex.destinataire},</p>
            <p className="mt-2 text-[13px] text-foreground-700 whitespace-pre-line leading-relaxed">{corps}</p>

            {type === "devis" && (
              <div className="mt-4">
                <span
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-md text-[13px] font-semibold text-background-50"
                  style={{ backgroundColor: couleur }}
                >
                  <i className="ri-quill-pen-line"></i>
                  Consulter et signer le devis
                </span>
              </div>
            )}

            {type === "facture" && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 h-10 rounded-md bg-background-100 border border-background-200 text-[12px] text-foreground-700">
                <i className="ri-attachment-2" style={{ color: couleur }}></i>
                Facture_{ex.numero}.pdf
              </div>
            )}

            {type === "relance" && (
              <div className="mt-4 rounded-md bg-background-100 px-3 py-2 text-[11px] text-foreground-500">
                Le message peut encore être ajusté avant l'envoi, puis l'historique de relance est mis à jour.
              </div>
            )}
          </div>
        </div>

        {/* Pied de page de l'email */}
        <div className="px-5 py-4 bg-background-100 border-t border-background-200 text-center">
          <p className="text-[11px] text-foreground-400">Email envoyé via ArtiFlow-pro pour {nom}.</p>
          {piedTrim && <p className="mt-1 text-[11px] text-foreground-500 whitespace-pre-line">{piedTrim}</p>}
        </div>
      </div>
    </div>
  );
}