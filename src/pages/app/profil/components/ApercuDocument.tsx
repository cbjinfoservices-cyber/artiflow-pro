/**
 * Aperçu en direct d'un document (facture) dans le profil.
 *
 * Reflète instantanément les réglages d'apparence en cours d'édition — couleur d'accent,
 * affichage du logo, coordonnées de paiement et message de pied de page — sans générer de PDF.
 * Sert de contrôle visuel avant d'enregistrer les modifications.
 */
export default function ApercuDocument({
  entreprise,
  couleur,
  afficherLogo,
  logoUrl,
  paiement,
  piedPage,
  metier,
  modele = "standard",
}: {
  entreprise: string;
  couleur: string;
  afficherLogo: boolean;
  logoUrl: string | null;
  /** Coordonnées de paiement (affichées sur les factures), texte libre. */
  paiement: string;
  /** Message de pied de page libre. */
  piedPage: string;
  /** Libellé du métier, affiché sous le nom de l'entreprise. */
  metier: string;
  /** Modèle de mise en page du tableau des lignes : « standard » (défaut) ou « compact ». */
  modele?: "standard" | "compact";
}) {
  const compact = modele === "compact";
  const nom = entreprise.trim() || "Mon entreprise";
  const initiales =
    nom
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "AF";
  const paiementTrim = paiement.trim();
  const piedTrim = piedPage.trim();

  // Indicateur de complétude de l'identité : liste ce qui manque pour des documents aboutis.
  const manques: { icone: string; texte: string }[] = [];
  if (!logoUrl) manques.push({ icone: "ri-image-line", texte: "logo non renseigné" });
  else if (!afficherLogo) manques.push({ icone: "ri-eye-off-line", texte: "logo masqué sur les documents" });
  if (!paiementTrim) manques.push({ icone: "ri-bank-card-line", texte: "coordonnées de paiement non renseignées" });
  if (!piedTrim) manques.push({ icone: "ri-file-text-line", texte: "message de pied de page non renseigné" });
  const totalCriteres = 3;
  const atteints = totalCriteres - manques.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Indicateur de complétude de l'identité des documents */}
      <div className="rounded-lg border border-background-200 bg-background-100 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-md ${
                manques.length === 0 ? "bg-accent-100 text-accent-700" : "bg-primary-100 text-primary-700"
              }`}
            >
              <i className={manques.length === 0 ? "ri-checkbox-circle-line text-sm" : "ri-question-line text-sm"}></i>
            </span>
            <p className="text-sm font-semibold text-foreground-900">Complétude de l'identité</p>
          </div>
          <span
            className={`inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
              manques.length === 0 ? "bg-accent-100 text-accent-800" : "bg-secondary-100 text-secondary-800"
            }`}
          >
            {atteints}/{totalCriteres}
          </span>
        </div>
        {manques.length > 0 ? (
          <>
            <p className="text-[11px] text-foreground-500 mt-2">Finalisez ces éléments pour des documents complets :</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {manques.map((m) => (
                <span
                  key={m.texte}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-accent-100 text-accent-900 text-[11px] font-semibold whitespace-nowrap"
                >
                  <i className={m.icone}></i>
                  {m.texte}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-[12px] text-accent-700 font-semibold mt-2 inline-flex items-center gap-1.5">
            <i className="ri-checkbox-circle-line"></i>
            Identité complète : vos documents sont prêts à envoyer.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-background-200 overflow-hidden bg-background-50">
        {/* Barre d'accent supérieure (couleur personnalisable). */}
        <div className="h-1.5" style={{ backgroundColor: couleur }} />

        <div className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              {afficherLogo && logoUrl ? (
                <span className="w-10 h-10 shrink-0 rounded-md bg-background-100 border border-background-200 flex items-center justify-center overflow-hidden">
                  <img src={logoUrl} alt="Aperçu du logo" className="w-full h-full object-contain" />
                </span>
              ) : afficherLogo ? (
                <span
                  className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-[13px] font-heading font-bold text-background-50"
                  style={{ backgroundColor: couleur }}
                >
                  {initiales}
                </span>
              ) : null}
              <div className="min-w-0">
                <p className="font-heading font-bold text-sm text-foreground-950 truncate">{nom}</p>
                <p className="text-[11px] text-foreground-500 truncate">{metier || "Votre métier"} · 06 12 34 56 78</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-heading font-extrabold text-base tracking-wide text-foreground-950">FACTURE</p>
              <p className="text-[11px] text-foreground-500">N° F-2026-014</p>
              <p className="text-[11px] text-foreground-500">16/10/2026</p>
            </div>
          </div>

          <div className="h-px bg-background-200 my-4" />

          <p className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">Client</p>
          <p className="text-[13px] font-semibold text-foreground-900 mt-0.5">M. Julien Bernard</p>
          <p className="text-[11px] text-foreground-500">12 rue des Lilas · 69006 Lyon</p>

          <div className="mt-4 rounded-md bg-background-100 px-3 py-2">
            <p className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">Objet</p>
            <p className="text-[12px] text-foreground-800">Rénovation salle de bain</p>
          </div>

          <table className="w-full mt-4 text-[11px]">
            <thead>
              <tr className="text-foreground-500">
                <th className="text-left font-semibold pb-1.5 border-b border-background-200">Désignation</th>
                {compact ? (
                  <>
                    <th className="text-right font-semibold pb-1.5 border-b border-background-200">Qté</th>
                    <th className="text-right font-semibold pb-1.5 border-b border-background-200">
                      P.U. HT / Total HT
                    </th>
                  </>
                ) : (
                  <>
                    <th className="text-right font-semibold pb-1.5 border-b border-background-200">Qté</th>
                    <th className="text-right font-semibold pb-1.5 border-b border-background-200">P.U. HT</th>
                    <th className="text-right font-semibold pb-1.5 border-b border-background-200">TVA</th>
                    <th className="text-right font-semibold pb-1.5 border-b border-background-200">Total HT</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="text-foreground-800">
              {compact ? (
                <>
                  <tr>
                    <td className="py-1.5 border-b border-background-100">Dépose et évacuation</td>
                    <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">1</td>
                    <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">
                      <span className="block text-foreground-500">420,00 €</span>
                      <span className="block font-semibold text-foreground-950">420,00 €</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 border-b border-background-100">Pose faïence et plomberie</td>
                    <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">12 m²</td>
                    <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">
                      <span className="block text-foreground-500">330,00 €</span>
                      <span className="block font-semibold text-foreground-950">3 960,00 €</span>
                    </td>
                  </tr>
                </>
              ) : (
                <>
                  <tr>
                    <td className="py-1.5 border-b border-background-100">Dépose et évacuation</td>
                    <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">1</td>
                    <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">420,00 €</td>
                    <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">20 %</td>
                    <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">420,00 €</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 border-b border-background-100">Pose faïence et plomberie</td>
                    <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">12 m²</td>
                    <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">330,00 €</td>
                    <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">20 %</td>
                    <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">3 960,00 €</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          <div className="mt-3 flex justify-end">
            <div className="w-48 rounded-md bg-background-100 flex overflow-hidden">
              <span className="w-1 shrink-0" style={{ backgroundColor: couleur }} />
              <div className="flex-1 px-3 py-2 text-[11px]">
                <div className="flex justify-between text-foreground-500">
                  <span>Total HT</span>
                  <span className="text-foreground-900">4 380,00 €</span>
                </div>
                <div className="flex justify-between text-foreground-500 mt-0.5">
                  <span>TVA</span>
                  <span className="text-foreground-900">876,00 €</span>
                </div>
                <div className="flex justify-between font-bold text-foreground-950 pt-1 mt-1 border-t border-background-200">
                  <span>Total TTC</span>
                  <span>5 256,00 €</span>
                </div>
              </div>
            </div>
          </div>

          {paiementTrim && (
            <div className="mt-4 rounded-md bg-background-100 flex overflow-hidden">
              <span className="w-1 shrink-0" style={{ backgroundColor: couleur }} />
              <div className="flex-1 px-3 py-2">
                <p className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">
                  Coordonnées de paiement
                </p>
                <p className="text-[11px] text-foreground-700 whitespace-pre-line mt-0.5">{paiementTrim}</p>
              </div>
            </div>
          )}

          {piedTrim && (
            <p className="mt-3 text-center text-[11px] text-foreground-600 whitespace-pre-line">{piedTrim}</p>
          )}

          <div className="mt-4 pt-3 border-t border-background-200 flex items-center justify-between gap-3 text-[10px] text-foreground-400">
            <span>Document généré avec ArtiFlow-pro</span>
            <span>Échéance : 15/11/2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}