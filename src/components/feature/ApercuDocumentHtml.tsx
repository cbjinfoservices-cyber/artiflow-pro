import { formatEuros } from "@/lib/format";

/** Une ligne affichée dans l'aperçu visuel d'un document. */
export interface ApercuDocLigne {
  designation: string;
  unite: string;
  quantite: number;
  prix_unitaire: number;
  /** Taux de TVA de la ligne, en pourcentage (20 par défaut). */
  taux_tva?: number;
}

export interface ApercuDocEmetteur {
  entreprise: string;
  metier?: string | null;
  telephone?: string | null;
  email?: string | null;
  logo?: string | null;
  siret?: string | null;
  tva?: string | null;
  assurance?: string | null;
  formeJuridique?: string | null;
}

export interface ApercuDocClient {
  nom: string;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
}

/**
 * Aperçu VISUEL (HTML) d'un document devis ou facture, calqué sur le rendu du PDF.
 *
 * Contrairement à l'aperçu PDF (une iframe), ce composant est du HTML/CSS natif : il se
 * met à jour en direct quand les données changent, ce qui en fait l'outil idéal pour
 * vérifier la mise en page pendant la saisie des lignes.
 */
export default function ApercuDocumentHtml({
  type,
  numero,
  dateLabel,
  statut,
  objet,
  emetteur,
  client,
  lignes,
  totalHT,
  totalTTC,
  accent = "#C4783A",
  afficherLogo = true,
  paiement = null,
  piedPage = null,
  signature,
  modele = "standard",
}: {
  type: "devis" | "facture";
  numero: string;
  dateLabel: string;
  statut: string;
  objet: string;
  emetteur: ApercuDocEmetteur;
  client: ApercuDocClient | null;
  lignes: ApercuDocLigne[];
  totalHT: number;
  totalTTC: number;
  /** Couleur d'accent (hexadécimale) des documents. */
  accent?: string;
  /** Afficher le logo de l'entreprise en en-tête. */
  afficherLogo?: boolean;
  /** Coordonnées de paiement (factures), texte libre. */
  paiement?: string | null;
  /** Message de pied de page libre. */
  piedPage?: string | null;
  /** Signature du client (devis signés). */
  signature?: { nom: string; dateLabel: string } | null;
  /** Modèle de mise en page du tableau : « standard » (défaut) ou « compact ». */
  modele?: "standard" | "compact";
}) {
  const compact = modele === "compact";
  const titre = type === "devis" ? "DEVIS" : "FACTURE";
  const nom = emetteur.entreprise.trim() || "Mon entreprise";
  const couleur = accent || "#C4783A";
  const tva = Math.max(0, totalTTC - totalHT);
  const initiales =
    nom
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "AF";

  const coordEmetteur = [emetteur.metier, emetteur.telephone, emetteur.email].filter(
    (v) => v && String(v).trim().length > 0,
  ) as string[];
  const coordClient = client
    ? ([client.adresse, client.telephone, client.email].filter((v) => v && String(v).trim().length > 0) as string[])
    : [];
  const paiementTrim = paiement?.trim() ? paiement.trim() : "";
  const piedTrim = piedPage?.trim() ? piedPage.trim() : "";

  const tauxLabel = (v: number | undefined) => `${String(Number.isFinite(Number(v)) ? Number(v) : 20).replace(".", ",")} %`;

  return (
    <div className="rounded-lg border border-background-200 overflow-hidden bg-background-50">
      {/* Barre d'accent supérieure (couleur personnalisable). */}
      <div className="h-1.5" style={{ backgroundColor: couleur }} />

      <div className="p-5 md:p-6">
        {/* En-tête : émetteur + titre du document */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {afficherLogo && emetteur.logo ? (
              <span className="w-10 h-10 shrink-0 rounded-md bg-background-100 border border-background-200 flex items-center justify-center overflow-hidden">
                <img src={emetteur.logo} alt="Logo de l'entreprise" className="w-full h-full object-contain" />
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
              <p className="text-[11px] text-foreground-500 truncate">
                {coordEmetteur.length ? coordEmetteur.join(" · ") : "Vos coordonnées"}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-heading font-extrabold text-base tracking-wide text-foreground-950">{titre}</p>
            <p className="text-[11px] text-foreground-500">N° {numero || "—"}</p>
            <p className="text-[11px] text-foreground-500">{dateLabel}</p>
            <p className="text-[11px] text-foreground-500">Statut : {statut}</p>
          </div>
        </div>

        <div className="h-px bg-background-200 my-4" />

        {/* Bloc client */}
        <p className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">Client</p>
        <p className="text-[13px] font-semibold text-foreground-900 mt-0.5">{client?.nom || "—"}</p>
        {coordClient.map((line, i) => (
          <p key={i} className="text-[11px] text-foreground-500">
            {line}
          </p>
        ))}

        {/* Objet */}
        <div className="mt-4 rounded-md bg-background-100 px-3 py-2">
          <p className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">Objet</p>
          <p className="text-[12px] text-foreground-800">{objet || "—"}</p>
        </div>

        {/* Tableau des lignes */}
        <table className="w-full mt-4 text-[11px]">
          <thead>
            <tr className="text-foreground-500">
              <th className="text-left font-semibold pb-1.5 border-b border-background-200">Désignation</th>
              {compact ? (
                <>
                  <th className="text-right font-semibold pb-1.5 border-b border-background-200">Qté</th>
                  <th className="text-right font-semibold pb-1.5 border-b border-background-200">P.U. HT / Total HT</th>
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
            {lignes.length === 0 ? (
              <tr>
                <td
                  colSpan={compact ? 3 : 5}
                  className="py-2 text-center text-foreground-400 border-b border-background-100"
                >
                  Aucune ligne détaillée
                </td>
              </tr>
            ) : (
              lignes.map((l, i) => (
                <tr key={i}>
                  <td className="py-1.5 border-b border-background-100">{l.designation || "—"}</td>
                  {compact ? (
                    <>
                      <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">
                        {`${l.quantite} ${l.unite}`.trim()}
                      </td>
                      <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">
                        <span className="block text-foreground-500">{formatEuros(l.prix_unitaire)}</span>
                        <span className="block font-semibold text-foreground-950">
                          {formatEuros(l.quantite * l.prix_unitaire)}
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">
                        {`${l.quantite} ${l.unite}`.trim()}
                      </td>
                      <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">
                        {formatEuros(l.prix_unitaire)}
                      </td>
                      <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">
                        {tauxLabel(l.taux_tva)}
                      </td>
                      <td className="py-1.5 border-b border-background-100 text-right whitespace-nowrap">
                        {formatEuros(l.quantite * l.prix_unitaire)}
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Bloc des totaux */}
        <div className="mt-3 flex justify-end">
          <div className="w-48 rounded-md bg-background-100 flex overflow-hidden">
            <span className="w-1 shrink-0" style={{ backgroundColor: couleur }} />
            <div className="flex-1 px-3 py-2 text-[11px]">
              <div className="flex justify-between text-foreground-500">
                <span>Total HT</span>
                <span className="text-foreground-900">{formatEuros(totalHT)}</span>
              </div>
              <div className="flex justify-between text-foreground-500 mt-0.5">
                <span>TVA</span>
                <span className="text-foreground-900">{formatEuros(tva)}</span>
              </div>
              <div className="flex justify-between font-bold text-foreground-950 pt-1 mt-1 border-t border-background-200">
                <span>Total TTC</span>
                <span>{formatEuros(totalTTC)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Signature du client (devis signés) */}
        {signature && (
          <div className="mt-4 rounded-md border border-background-200 px-3 py-2">
            <p className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">Signature du client</p>
            <p className="text-[11px] text-foreground-700 mt-0.5">
              Signé par {signature.nom} le {signature.dateLabel}
            </p>
          </div>
        )}

        {/* Coordonnées de paiement (factures) */}
        {type === "facture" && paiementTrim && (
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

        {/* Message de pied de page libre */}
        {piedTrim && <p className="mt-3 text-center text-[11px] text-foreground-600 whitespace-pre-line">{piedTrim}</p>}

        <div className="mt-4 pt-3 border-t border-background-200 flex items-center justify-between gap-3 text-[10px] text-foreground-400">
          <span>Document généré avec ArtiFlow-pro</span>
        </div>
      </div>
    </div>
  );
}