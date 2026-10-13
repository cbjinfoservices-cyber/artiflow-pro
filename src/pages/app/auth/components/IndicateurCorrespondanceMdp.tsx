/**
 * Indicateur en direct de correspondance entre le mot de passe et sa confirmation.
 * Ne s'affiche que lorsque la confirmation est renseignée : vert quand les deux
 * champs sont identiques, rouge sinon. Évite de découvrir l'erreur seulement à la
 * soumission du formulaire.
 */
export default function IndicateurCorrespondanceMdp({
  motDePasse,
  confirmation,
}: {
  motDePasse: string;
  confirmation: string;
}) {
  if (!confirmation) return null;

  const correspondent = motDePasse === confirmation;

  return (
    <div
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
        correspondent
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-700"
      }`}
      role="status"
      aria-live="polite"
    >
      <span className="w-4 h-4 flex items-center justify-center shrink-0">
        <i className={correspondent ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
      </span>
      <span>
        {correspondent
          ? "Les mots de passe correspondent."
          : "Les mots de passe ne correspondent pas encore."}
      </span>
    </div>
  );
}