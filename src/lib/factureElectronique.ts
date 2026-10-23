import { telechargerBlob } from "@/lib/telechargement";
/**
 * Socle de la facturation électronique : statuts de cycle de vie, contrôles de
 * conformité et génération du fichier XML structuré au format Factur-X (profil
 * MINIMUM de la norme EN 16931).
 *
 * Ce module ne dépend d'aucune API externe : il produit un document lisible par
 * les plateformes de dématérialisation (PDP) et par Chorus Pro, à partir des
 * données déjà présentes dans l'application.
 */

/** Étape du cycle de vie d'une facture électronique. */
export type EfStatut = "non_preparee" | "preparee" | "transmise" | "recue" | "rejetee";

/** Ordre d'affichage des statuts (du moins avancé au plus avancé). */
export const EF_STATUTS: EfStatut[] = ["non_preparee", "preparee", "transmise", "recue", "rejetee"];

export interface EfStatutMeta {
  label: string;
  court: string;
  icone: string;
  /** Classes Tailwind de la pastille (fond + texte). */
  ton: string;
  aide: string;
}

export const EF_STATUT_META: Record<EfStatut, EfStatutMeta> = {
  non_preparee: {
    label: "À préparer",
    court: "À préparer",
    icone: "ri-file-add-line",
    ton: "bg-background-200 text-foreground-700",
    aide: "Facture encore au format PDF classique : aucun fichier structuré n'a été généré.",
  },
  preparee: {
    label: "Prête à transmettre",
    court: "Prête",
    icone: "ri-file-code-line",
    ton: "bg-secondary-100 text-secondary-800",
    aide: "Le fichier XML Factur-X a été généré : il ne reste plus qu'à le transmettre.",
  },
  transmise: {
    label: "Transmise",
    court: "Transmise",
    icone: "ri-send-plane-line",
    ton: "bg-primary-100 text-primary-800",
    aide: "Le fichier a été déposé sur votre plateforme de dématérialisation (ou remis au client).",
  },
  recue: {
    label: "Reçue / acceptée",
    court: "Reçue",
    icone: "ri-checkbox-circle-line",
    ton: "bg-accent-100 text-accent-800",
    aide: "La plateforme ou le client a accusé réception de la facture électronique.",
  },
  rejetee: {
    label: "Rejetée",
    court: "Rejetée",
    icone: "ri-error-warning-line",
    ton: "bg-red-100 text-red-700",
    aide: "La facture est revenue en erreur : corrigez le motif puis transmettez à nouveau.",
  },
};

/** Ramène une valeur quelconque vers un statut valide. */
export function normalizeEfStatut(value: unknown): EfStatut {
  const s = String(value ?? "");
  return (EF_STATUTS as string[]).includes(s) ? (s as EfStatut) : "non_preparee";
}

/* ------------------------------ CONTRÔLES ------------------------------ */

export interface EfControle {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  /** Chemin interne vers l'écran où corriger l'information manquante. */
  lien?: string;
}

export interface EfProfilSource {
  siret: string | null;
  tva: string | null;
  entreprise: string | null;
  email: string | null;
  telephone: string | null;
  doc_paiement?: string | null;
  efacture_dispense_tva?: boolean | null;
  efacture_pdp?: string | null;
}

/**
 * Vérifie les informations indispensables à une facture électronique conforme :
 * identité de l'émetteur, identifiant fiscal, TVA (ou dispense), coordonnées de
 * règlement et plateforme de transmission.
 */
export function controlerConformite(profil: EfProfilSource | null): EfControle[] {
  const p = profil ?? {
    siret: null,
    tva: null,
    entreprise: null,
    email: null,
    telephone: null,
  };
  const dispense = Boolean(p.efacture_dispense_tva);
  return [
    {
      id: "entreprise",
      label: "Nom de l'entreprise",
      ok: Boolean(p.entreprise && p.entreprise.trim()),
      detail: p.entreprise?.trim() ? p.entreprise : "Renseignez la raison sociale dans votre profil.",
      lien: "/app/profil",
    },
    {
      id: "siret",
      label: "SIRET (14 chiffres)",
      ok: Boolean(p.siret && p.siret.replace(/\s/g, "").length >= 14),
      detail: p.siret?.trim() ? p.siret : "Le SIRET identifie l'émetteur de la facture.",
      lien: "/app/profil",
    },
    {
      id: "tva",
      label: dispense ? "Dispense de TVA déclarée" : "Numéro de TVA intracommunautaire",
      ok: dispense || Boolean(p.tva && p.tva.trim()),
      detail: dispense
        ? "Franchise en base : la mention « TVA non applicable, art. 293 B du CGI » doit figurer sur chaque facture."
        : p.tva?.trim()
          ? p.tva
          : "Numéro de TVA, ou cochez la dispense si vous êtes en franchise en base.",
      lien: "/app/profil",
    },
    {
      id: "paiement",
      label: "Coordonnées de règlement",
      ok: Boolean(p.doc_paiement && p.doc_paiement.trim()),
      detail: p.doc_paiement?.trim()
        ? "IBAN / conditions repris sur les factures."
        : "Ajoutez un IBAN ou vos conditions de paiement dans les réglages de documents.",
      lien: "/app/profil",
    },
    {
      id: "contact",
      label: "Contact émetteur",
      ok: Boolean(p.email?.trim() || p.telephone?.trim()),
      detail: p.email?.trim() || p.telephone?.trim() || "Un email ou un téléphone est nécessaire sur la facture.",
      lien: "/app/profil",
    },
  ];
}

/* ------------------------------ FACTUR-X ------------------------------ */

export interface EfLigne {
  designation: string;
  unite: string;
  quantite: number;
  prix_unitaire: number;
  taux_tva: number;
}

export interface EfEmetteur {
  nom: string;
  siret: string | null;
  tva: string | null;
  adresse?: string | null;
  email?: string | null;
  telephone?: string | null;
  dispenseTva: boolean;
  optionDebits: boolean;
  autoliquidation: boolean;
}

export interface EfClient {
  nom: string;
  siret: string | null;
  adresse: string | null;
  email: string | null;
}

export interface EfFactureSource {
  numero: string;
  dateEmission: string | null;
  dateEcheance: string | null;
  objet: string | null;
  lignes: EfLigne[];
  estAvoir: boolean;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Convertit une date ISO (AAAA-MM-JJ) au format 102 attendu par Factur-X (AAAAMMJJ). */
function formatDate102(value: string | null): string {
  const d = value ? new Date(`${value.slice(0, 10)}T00:00:00`) : new Date();
  const date = Number.isNaN(d.getTime()) ? new Date() : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** Montant à deux décimales, séparateur point (format attendu dans le XML). */
function n2(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  return v.toFixed(2);
}

/**
 * Construit le XML Factur-X (profil MINIMUM, EN 16931) d'une facture.
 * Le résultat est un fichier autonome, prêt à être déposé sur une plateforme
 * de dématérialisation ou transmis à un client professionnel.
 */
export function buildFacturXXml(facture: EfFactureSource, emetteur: EfEmetteur, client: EfClient): string {
  const lignes = facture.lignes.length > 0 ? facture.lignes : [];
  const totalHt = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);
  const totalTva = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire * (l.taux_tva / 100), 0);
  const totalTtc = totalHt + totalTva;
  const signe = facture.estAvoir ? -1 : 1;
  const typeCode = facture.estAvoir ? "381" : "380";

  // Regroupement des bases et montants de TVA par taux (une ligne par taux).
  const parTaux = new Map<number, { base: number; montant: number }>();
  lignes.forEach((l) => {
    const taux = Number.isFinite(l.taux_tva) ? l.taux_tva : 0;
    const base = l.quantite * l.prix_unitaire;
    const entry = parTaux.get(taux) ?? { base: 0, montant: 0 };
    entry.base += base;
    entry.montant += base * (taux / 100);
    parTaux.set(taux, entry);
  });
  if (parTaux.size === 0) parTaux.set(0, { base: 0, montant: 0 });

  const notes: string[] = [];
  if (emetteur.optionDebits) notes.push("Option pour le paiement de la TVA d'après les débits.");
  if (emetteur.autoliquidation) notes.push("Autoliquidation par le preneur (art. 283-2 nonies du CGI).");
  if (emetteur.dispenseTva) notes.push("TVA non applicable, art. 293 B du CGI.");
  if (facture.objet?.trim()) notes.push(`Objet : ${facture.objet.trim()}`);

  const ligneXml = lignes
    .map((l, index) => {
      const total = l.quantite * l.prix_unitaire;
      const taux = Number.isFinite(l.taux_tva) ? l.taux_tva : 0;
      return `      <ram:IncludedSupplyChainTradeLineItem>
        <ram:AssociatedDocumentLineDocument>
          <ram:LineID>${index + 1}</ram:LineID>
        </ram:AssociatedDocumentLineDocument>
        <ram:SpecifiedTradeProduct>
          <ram:Name>${escapeXml(l.designation || "Prestation")}</ram:Name>
        </ram:SpecifiedTradeProduct>
        <ram:SpecifiedLineTradeAgreement>
          <ram:NetPriceProductTradePrice>
            <ram:ChargeAmount>${n2(Math.abs(l.prix_unitaire))}</ram:ChargeAmount>
          </ram:NetPriceProductTradePrice>
        </ram:SpecifiedLineTradeAgreement>
        <ram:SpecifiedLineTradeDelivery>
          <ram:BilledQuantity unitCode="${escapeXml((l.unite || "C62").slice(0, 3).toUpperCase())}">${n2(Math.abs(l.quantite))}</ram:BilledQuantity>
        </ram:SpecifiedLineTradeDelivery>
        <ram:SpecifiedLineTradeSettlement>
          <ram:ApplicableTradeTax>
            <ram:TypeCode>VAT</ram:TypeCode>
            <ram:CategoryCode>${taux > 0 ? "S" : "Z"}</ram:CategoryCode>
            <ram:RateApplicablePercent>${n2(taux)}</ram:RateApplicablePercent>
          </ram:ApplicableTradeTax>
          <ram:SpecifiedTradeSettlementLineMonetarySummation>
            <ram:LineTotalAmount>${n2(Math.abs(total))}</ram:LineTotalAmount>
          </ram:SpecifiedTradeSettlementLineMonetarySummation>
        </ram:SpecifiedLineTradeSettlement>
      </ram:IncludedSupplyChainTradeLineItem>`;
    })
    .join("\n");

  const tvaXml = Array.from(parTaux.entries())
    .map(
      ([taux, montant]) => `      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${n2(Math.abs(montant.montant))}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${n2(Math.abs(montant.base))}</ram:BasisAmount>
        <ram:CategoryCode>${taux > 0 ? "S" : "Z"}</ram:CategoryCode>
        <ram:RateApplicablePercent>${n2(taux)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`,
    )
    .join("\n");

  const notesXml = notes
    .map(
      (texte) => `      <ram:IncludedNote>
        <ram:Content>${escapeXml(texte)}</ram:Content>
      </ram:IncludedNote>`,
    )
    .join("\n");

  const sellerTax = emetteur.tva?.trim()
    ? `        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${escapeXml(emetteur.tva.trim())}</ram:ID>
        </ram:SpecifiedTaxRegistration>`
    : "";
  const sellerSiret = emetteur.siret?.trim()
    ? `        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0009">${escapeXml(emetteur.siret.replace(/\s/g, ""))}</ram:ID>
        </ram:SpecifiedLegalOrganization>`
    : "";
  const buyerSiret = client.siret?.trim()
    ? `      <ram:SpecifiedLegalOrganization>
        <ram:ID schemeID="0009">${escapeXml(client.siret.replace(/\s/g, ""))}</ram:ID>
      </ram:SpecifiedLegalOrganization>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:BusinessProcessSpecifiedDocumentContextParameter>
      <ram:ID>A1</ram:ID>
    </ram:BusinessProcessSpecifiedDocumentContextParameter>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:minimum</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(facture.numero)}</ram:ID>
    <ram:TypeCode>${typeCode}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${formatDate102(facture.dateEmission)}</udt:DateTimeString>
    </ram:IssueDateTime>
${notesXml}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${ligneXml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(emetteur.nom || "Mon entreprise")}</ram:Name>
${sellerSiret}
        <ram:PostalTradeAddress>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:URIUniversalCommunication>
          <ram:URIID schemeID="EM">${escapeXml(emetteur.email || "")}</ram:URIID>
        </ram:URIUniversalCommunication>
${sellerTax}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(client.nom || "Client")}</ram:Name>
${buyerSiret}
        <ram:PostalTradeAddress>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${n2(Math.abs(totalHt))}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${n2(Math.abs(totalHt))}</ram:TaxBasisTotalAmount>
${tvaXml}
        <ram:TaxTotalAmount currencyID="EUR">${n2(Math.abs(totalTva))}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${n2(Math.abs(totalTtc))}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${n2(Math.abs(totalTtc) * signe)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${formatDate102(facture.dateEcheance ?? facture.dateEmission)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`;
}

/** Nom de fichier du XML, aligné sur le numéro de la facture. */
export function nomFichierXml(numero: string): string {
  const base = (numero || "facture").replace(/[^A-Za-z0-9_-]+/g, "-");
  return `${base}.xml`;
}

/** Déclenche le téléchargement du XML dans le navigateur. */
export function telechargerXml(filename: string, xml: string): void {
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  telechargerBlob(filename, blob);
}

/* ------------------------------ MENTIONS ------------------------------ */

export interface EfMentionsSource {
  efacture_option_debits?: boolean | null;
  efacture_autoliquidation?: boolean | null;
  efacture_dispense_tva?: boolean | null;
  efacture_mentions_libres?: string | null;
}

/**
 * Construit les mentions complémentaires à imprimer sur les factures, à partir
 * des réglages choisis par l'artisan (option TVA sur les débits, autoliquidation,
 * franchise en base, texte libre).
 */
export function mentionsEfactureProfil(profil: EfMentionsSource | null): string[] {
  if (!profil) return [];
  const mentions: string[] = [];
  if (profil.efacture_option_debits) {
    mentions.push("Option pour le paiement de la TVA d'après les débits.");
  }
  if (profil.efacture_autoliquidation) {
    mentions.push("Autoliquidation par le preneur — art. 283-2 nonies du CGI.");
  }
  if (profil.efacture_dispense_tva) {
    mentions.push("TVA non applicable, art. 293 B du CGI.");
  }
  const libre = profil.efacture_mentions_libres?.trim();
  if (libre) {
    libre
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((l) => mentions.push(l));
  }
  return mentions;
}

/* ------------------------------ REGISTRE ------------------------------ */

export interface EfRegistreLigne {
  numero: string;
  client: string;
  dateEmission: string;
  statut: string;
  montantTtc: number;
  transmisLe: string | null;
  motif: string | null;
}

/** Construit le registre de suivi au format CSV (une ligne par facture). */
export function buildRegistreCsv(lignes: EfRegistreLigne[]): string {
  const entete = ["Numero", "Client", "Date emission", "Statut electronique", "Montant TTC", "Transmis le", "Motif"];
  const corps = lignes.map((l) => [
    l.numero,
    l.client,
    l.dateEmission,
    EF_STATUT_META[normalizeEfStatut(l.statut)].label,
    String(l.montantTtc).replace(".", ","),
    l.transmisLe ?? "",
    l.motif ?? "",
  ]);
  const echapper = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  return [entete, ...corps].map((row) => row.map(echapper).join(";")).join("\r\n");
}