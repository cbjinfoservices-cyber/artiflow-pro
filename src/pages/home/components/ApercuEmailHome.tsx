/**
 * Petit aperçu visuel d'un email client envoyé « à vos couleurs ».
 *
 * Sert d'illustration marketing sur la page d'accueil (et sur les pages métiers) :
 * on montre l'identité personnalisée (barre d'accent, logo, bouton, pied de page)
 * avant même que le visiteur n'aille sur la page Tarifs. Toutes les valeurs sont
 * des exemples figés, aucun envoi réel n'est déclenché.
 */

type Props = {
  /** Nom affiché de l'expéditeur (l'entreprise de l'artisan). */
  entreprise?: string;
  /** Ligne secondaire : métier et/ou ville. */
  role?: string;
  /** Initiales utilisées dans la pastille logo quand il n'y a pas d'image. */
  initiales?: string;
  /** Objet de l'email affiché. */
  objet?: string;
  /** Message du corps de l'email. */
  message?: string;
  /** Montant cité dans le devis. */
  montant?: string;
  /** Numéro du devis cité. */
  numero?: string;
  /** Message de pied de page libre. */
  piedPage?: string;
  /** Classes supplémentaires sur le conteneur. */
  className?: string;
};

export default function ApercuEmailHome({
  entreprise = "Plomberie Benali",
  role = "Plombier chauffagiste · Lyon",
  initiales = "PB",
  objet = "Votre devis D-2026-014 · Rénovation salle de bain",
  message = "Voici votre devis D-2026-014 d'un montant de 5 256,00 €. Vous pouvez le signer directement en ligne via le bouton ci-dessous.",
  montant = "5 256,00 €",
  numero = "D-2026-014",
  piedPage = "Merci de votre confiance · Devis gratuit sous 48 h",
  className = "",
}: Props) {
  const nom = entreprise.trim() || "Votre entreprise";
  const contact = role.trim();
  const corps = message.replaceAll("{{montant}}", montant).replaceAll("{{numero}}", numero);
  const pied = piedPage.trim();

  return (
    <div className={`rounded-lg border border-background-200 overflow-hidden bg-background-50 ${className}`}>
      {/* Barre d'accent (couleur personnalisable du profil). */}
      <div className="h-1.5 bg-accent-500" />

      <div className="p-5">
        {/* En-tête expéditeur : logo + nom + contacts */}
        <div className="flex items-center gap-2.5 pb-4 border-b border-background-200">
          <span className="w-10 h-10 shrink-0 rounded-full bg-accent-500 text-background-50 flex items-center justify-center font-heading font-bold text-sm">
            {initiales}
          </span>
          <div className="min-w-0">
            <p className="font-heading font-bold text-sm text-foreground-950 truncate">{nom}</p>
            {contact && <p className="text-[11px] text-foreground-500 truncate">{contact}</p>}
          </div>
          <span className="ml-auto inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-bold whitespace-nowrap">
            <i className="ri-mail-line"></i>
            Email client
          </span>
        </div>

        {/* Objet */}
        <p className="mt-4 text-[11px] text-foreground-500">Objet :</p>
        <p className="text-[13px] font-semibold text-foreground-900 leading-snug">{objet}</p>

        {/* Corps du message */}
        <p className="mt-3 text-[13px] text-foreground-800">Bonjour M. Bernard,</p>
        <p className="mt-1.5 text-[13px] text-foreground-700 leading-relaxed">{corps}</p>

        {/* Bouton d'action à la couleur d'accent */}
        <span className="mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-md bg-accent-500 text-background-50 text-[12px] font-semibold whitespace-nowrap">
          <i className="ri-quill-pen-line"></i>
          Consulter et signer le devis
        </span>
      </div>

      {/* Pied de page de l'email */}
      <div className="px-5 py-3 bg-background-100 border-t border-background-200 text-center">
        {pied && <p className="text-[11px] text-foreground-500 whitespace-pre-line">{pied}</p>}
      </div>
    </div>
  );
}