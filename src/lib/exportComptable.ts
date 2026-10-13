import { toCsv } from "@/lib/csv";

export interface ComptaLigne {
  designation: string;
  unite: string;
  quantite: number;
  prix_unitaire: number;
  taux_tva: number;
}

export interface ComptaDevis {
  numero: string;
  clientId?: number | null;
  clientNom: string | null;
  objet: string | null;
  total_ht: number;
  total_ttc: number;
  statut: string;
  created_at: string;
}

export interface ComptaFacture {
  numero: string;
  clientId?: number | null;
  clientNom: string | null;
  objet: string | null;
  total_ht: number;
  total_ttc: number;
  statut: string;
  date_emission: string | null;
  date_echeance: string | null;
  /** Date réelle du règlement (quand la facture est payée). */
  date_paiement?: string | null;
  created_at: string;
  /** Copie figée des lignes, pour ventiler la TVA par taux. */
  lignes?: ComptaLigne[] | null;
}

export interface JournalLigne {
  /** Date de référence (ISO ou déjà formatée) pour l'affichage. */
  date: string;
  type: "Devis" | "Facture" | "Avoir" | "Paiement";
  numero: string;
  client: string;
  objet: string;
  ht: number;
  tva: number;
  ttc: number;
  statut: string;
  /** Timestamp de tri chronologique (jamais exporté tel quel). */
  ts: number;
}

/** Arrondi au centime, pour éviter les dérives de flottants dans les totaux. */
function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

/** Montant au format comptable français : « 1 250,00 ». */
function montant(value: number): string {
  return round2(value).toFixed(2).replace(".", ",");
}

/** Date au format court français « 05/10/2026 », ou vide si absente/invalide. */
function dateFr(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR");
}

/** Un document est un avoir (note de crédit) si son numéro porte le préfixe AV. */
export function isAvoir(numero: string | null | undefined): boolean {
  return (numero ?? "").trim().toUpperCase().startsWith("AV");
}

function tsOf(value: string | null | undefined): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Construit le journal comptable consolidé : une ligne par devis, par facture/avoir,
 * et une ligne par encaissement (facture payée). Trié chronologiquement.
 */
export function buildJournalLignes(devis: ComptaDevis[], factures: ComptaFacture[]): JournalLigne[] {
  const lignes: JournalLigne[] = [];

  devis.forEach((d) => {
    const ht = round2(d.total_ht);
    const ttc = round2(d.total_ttc);
    lignes.push({
      date: dateFr(d.created_at),
      type: "Devis",
      numero: d.numero,
      client: d.clientNom ?? "",
      objet: d.objet ?? "",
      ht,
      tva: round2(ttc - ht),
      ttc,
      statut: d.statut,
      ts: tsOf(d.created_at),
    });
  });

  factures.forEach((f) => {
    const ht = round2(f.total_ht);
    const ttc = round2(f.total_ttc);
    const dateRef = f.date_emission ?? f.created_at;
    lignes.push({
      date: dateFr(dateRef),
      type: isAvoir(f.numero) ? "Avoir" : "Facture",
      numero: f.numero,
      client: f.clientNom ?? "",
      objet: f.objet ?? "",
      ht,
      tva: round2(ttc - ht),
      ttc,
      statut: f.statut,
      ts: tsOf(dateRef),
    });
    if (f.statut === "Payée") {
      // L'encaissement est daté au jour réel du règlement (date_paiement),
      // avec repli sur la date d'émission pour les anciennes factures.
      const dateReglement = f.date_paiement ?? dateRef;
      lignes.push({
        date: dateFr(dateReglement),
        type: "Paiement",
        numero: f.numero,
        client: f.clientNom ?? "",
        objet: `Règlement de la facture ${f.numero}`,
        ht: 0,
        tva: 0,
        ttc,
        statut: "Encaissé",
        ts: tsOf(dateReglement),
      });
    }
  });

  return lignes.sort((a, b) => a.ts - b.ts || a.numero.localeCompare(b.numero, "fr"));
}

export interface ComptaTotaux {
  nbDevis: number;
  nbFactures: number;
  nbPaiements: number;
  devisHT: number;
  devisTTC: number;
  factureHT: number;
  factureTTC: number;
  avoirTTC: number;
  encaisse: number;
  resteAEncaisser: number;
  tvaCollectee: number;
}

/** Calcule les totaux de synthèse à partir des devis et factures d'une période. */
export function computeComptaTotaux(devis: ComptaDevis[], factures: ComptaFacture[]): ComptaTotaux {
  const devisHT = round2(devis.reduce((s, d) => s + Number(d.total_ht || 0), 0));
  const devisTTC = round2(devis.reduce((s, d) => s + Number(d.total_ttc || 0), 0));
  const facturesReelles = factures.filter((f) => !isAvoir(f.numero));
  const avoirs = factures.filter((f) => isAvoir(f.numero));
  const factureHT = round2(facturesReelles.reduce((s, f) => s + Number(f.total_ht || 0), 0));
  const factureTTC = round2(facturesReelles.reduce((s, f) => s + Number(f.total_ttc || 0), 0));
  const avoirTTC = round2(avoirs.reduce((s, f) => s + Number(f.total_ttc || 0), 0));
  const paiements = factures.filter((f) => f.statut === "Payée");
  const encaisse = round2(paiements.reduce((s, f) => s + Number(f.total_ttc || 0), 0));

  return {
    nbDevis: devis.length,
    nbFactures: factures.length,
    nbPaiements: paiements.length,
    devisHT,
    devisTTC,
    factureHT,
    factureTTC,
    avoirTTC,
    encaisse,
    resteAEncaisser: round2(factureTTC - encaisse),
    tvaCollectee: round2(factureTTC - factureHT),
  };
}

export interface TvaParTaux {
  /** Taux de TVA en pourcentage (20, 10, 5.5…). */
  taux: number;
  /** Base taxable HT cumulée pour ce taux. */
  baseHT: number;
  /** TVA collectée sur cette base. */
  tva: number;
  /** Total TTC de la base. */
  ttc: number;
  /** Nombre de factures concernées par ce taux. */
  nbDocuments: number;
}

/**
 * Ventile la TVA collectée par taux, à partir des lignes de chaque facture.
 * Une même facture peut alimenter plusieurs taux. Les avoirs (notes de crédit)
 * sont exclus, comme pour le total « TVA collectée ». Quand une facture ne porte
 * pas de lignes, on reconstitue le taux à partir de ses montants HT/TTC.
 */
export function computeTvaParTaux(factures: ComptaFacture[]): TvaParTaux[] {
  const reelles = factures.filter((f) => !isAvoir(f.numero));
  const acc = new Map<number, { base: number; tva: number; docs: number }>();
  const push = (taux: number, base: number, tva: number) => {
    const rate = Number.isFinite(Number(taux)) ? Number(taux) : 20;
    const cur = acc.get(rate) ?? { base: 0, tva: 0, docs: 0 };
    cur.base += base;
    cur.tva += tva;
    acc.set(rate, cur);
  };

  reelles.forEach((f) => {
    const rates = new Set<number>();
    if (f.lignes && f.lignes.length > 0) {
      f.lignes.forEach((l) => {
        const base = round2((Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0));
        const rate = Number.isFinite(Number(l.taux_tva)) ? Number(l.taux_tva) : 20;
        push(rate, base, round2((base * rate) / 100));
        rates.add(rate);
      });
    } else {
      const ht = round2(Number(f.total_ht) || 0);
      const ttc = round2(Number(f.total_ttc) || 0);
      const tva = round2(ttc - ht);
      const rate = ht > 0 && tva > 0 ? round2((tva / ht) * 100) : 20;
      push(rate, ht, tva);
      rates.add(rate);
    }
    rates.forEach((rate) => {
      const cur = acc.get(rate);
      if (cur) cur.docs += 1;
    });
  });

  return [...acc.entries()]
    .map(([taux, v]) => ({
      taux,
      baseHT: round2(v.base),
      tva: round2(v.tva),
      ttc: round2(v.base + v.tva),
      nbDocuments: v.docs,
    }))
    .sort((a, b) => b.taux - a.taux);
}

export interface BalanceAgeeBucket {
  /** Clé technique du palier (« 0-30 », « 30-60 », « 60+ »). */
  key: string;
  /** Libellé affiché du palier. */
  label: string;
  /** Montant TTC impayé cumulé sur ce palier. */
  montant: number;
  /** Nombre de factures concernées. */
  count: number;
}

export interface BalanceAgee {
  buckets: BalanceAgeeBucket[];
  /** Total TTC impayé toutes anciennetés confondues. */
  totalMontant: number;
  /** Nombre total de factures impayées. */
  totalCount: number;
}

/**
 * Calcule la balance âgée des créances : montants TTC encore impayés, répartis par
 * ancienneté (0-30 j, 30-60 j, +60 j) selon la date d'échéance (repli sur l'émission).
 * Les avoirs et les factures réglées sont exclus. Une facture non encore échue est
 * classée dans le premier palier.
 */
export function computeBalanceAgee(factures: ComptaFacture[], asOf: Date = new Date()): BalanceAgee {
  const buckets: BalanceAgeeBucket[] = [
    { key: "0-30", label: "0 à 30 jours", montant: 0, count: 0 },
    { key: "30-60", label: "30 à 60 jours", montant: 0, count: 0 },
    { key: "60+", label: "Plus de 60 jours", montant: 0, count: 0 },
  ];
  const ref = asOf.getTime();

  factures.forEach((f) => {
    if (isAvoir(f.numero)) return;
    if (f.statut === "Payée") return;
    const dateRef = f.date_echeance ?? f.date_emission ?? f.created_at;
    if (!dateRef) return;
    const d = new Date(dateRef).getTime();
    if (Number.isNaN(d)) return;
    const jours = Math.floor((ref - d) / 86400000);
    const bucket = jours <= 30 ? buckets[0] : jours <= 60 ? buckets[1] : buckets[2];
    bucket.montant = round2(bucket.montant + Number(f.total_ttc || 0));
    bucket.count += 1;
  });

  const totalMontant = round2(buckets.reduce((s, b) => s + b.montant, 0));
  const totalCount = buckets.reduce((s, b) => s + b.count, 0);
  return { buckets, totalMontant, totalCount };
}

const ENTETES = [
  "Date",
  "Type",
  "Numéro",
  "Client",
  "Objet",
  "Montant HT",
  "TVA",
  "Montant TTC",
  "Statut",
];

/**
 * Produit le contenu CSV d'un unique fichier consolidé (devis + factures + paiements),
 * suivi d'un récapitulatif de synthèse pour le comptable.
 */
export function buildJournalComptableCsv(devis: ComptaDevis[], factures: ComptaFacture[]): string {
  const lignes = buildJournalLignes(devis, factures);
  const t = computeComptaTotaux(devis, factures);

  const rows: (string | number)[][] = lignes.map((l) => [
    l.date,
    l.type,
    l.numero,
    l.client,
    l.objet,
    montant(l.ht),
    montant(l.tva),
    montant(l.ttc),
    l.statut,
  ]);

  rows.push([]);
  rows.push(["RÉCAPITULATIF COMPTABLE", "", "", "", ""]);
  rows.push(["Nombre de devis", "", "", "", t.nbDevis]);
  rows.push(["Total devis HT", "", "", "", montant(t.devisHT)]);
  rows.push(["Total devis TTC", "", "", "", montant(t.devisTTC)]);
  rows.push(["Nombre de factures", "", "", "", t.nbFactures]);
  rows.push(["Total facturé HT", "", "", "", montant(t.factureHT)]);
  rows.push(["TVA collectée", "", "", "", montant(t.tvaCollectee)]);
  rows.push(["Total facturé TTC", "", "", "", montant(t.factureTTC)]);
  rows.push(["Dont avoirs TTC", "", "", "", montant(t.avoirTTC)]);
  rows.push(["Total encaissé TTC", "", "", "", montant(t.encaisse)]);
  rows.push(["Reste à encaisser TTC", "", "", "", montant(t.resteAEncaisser)]);

  // Récapitulatif de TVA par taux (20 %, 10 %, 5,5 %…), base taxable et TVA collectée.
  const tvaParTaux = computeTvaParTaux(factures);
  rows.push([]);
  rows.push(["RÉCAPITULATIF TVA PAR TAUX", "", "", "", ""]);
  if (tvaParTaux.length === 0) {
    rows.push(["Aucune base taxable sur la période", "", "", "", ""]);
  } else {
    tvaParTaux.forEach((t) => {
      rows.push([
        `Taux ${montant(t.taux)} %`,
        `Base HT ${montant(t.baseHT)}`,
        `TVA ${montant(t.tva)}`,
        `TTC ${montant(t.ttc)}`,
        `${t.nbDocuments} facture(s)`,
      ]);
    });
  }

  return toCsv(ENTETES, rows);
}