import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  normalizeCanal,
  normalizeChantierStatut,
  normalizeDevisStatut,
  normalizeFactureStatut,
  relanceIsActive,
} from "@/lib/statuts";
import { fetchIntervenants, type Intervenant } from "@/lib/intervenants";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";

export interface DevisItem {
  id: number;
  numero: string;
  objet: string | null;
  statut: string;
  total_ht: number;
  total_ttc: number;
  created_at: string;
  client_id: number | null;
  clientNom: string | null;
  /** Clé du modèle d'origine si le devis a été généré depuis un modèle, sinon null. */
  modeleCle: string | null;
  /** Nom du modèle d'origine (pour le filtre « issu d'un modèle »), sinon null. */
  modeleNom: string | null;
  /** Date et heure de la signature du client (ISO), ou null si le devis n'est pas encore signé. */
  signedAt: string | null;
}

export interface ClientItem {
  id: number;
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  /** « professionnel » (entreprise) ou « particulier ». */
  type: string;
  /** Interlocuteur côté entreprise (uniquement pour les clients professionnels). */
  contact_nom: string | null;
  /** Numéro SIRET (clients professionnels). */
  siret: string | null;
  /** Secteur d'activité (clients professionnels). */
  secteur: string | null;
  /** Notes internes libres sur le client (non visibles par le client). */
  notes: string | null;
  /** Priorité de la note interne (« a_relancer », « sensible », « urgent », « info »), ou null. */
  note_priorite: string | null;
  /** Date de la dernière relance email envoyée à ce client (ISO), ou null si jamais relancé. */
  derniere_relance_at: string | null;
}

export interface EtapeItem {
  id: number;
  libelle: string;
  fait: boolean;
}

export interface ChantierItem {
  id: number;
  libelle: string | null;
  adresse: string | null;
  statut: string;
  date_debut: string | null;
  montant: number;
  client_id: number | null;
  clientNom: string | null;
  /** Intervenant qui pilote le chantier, ou null si personne n'est désigné. */
  intervenant_id: number | null;
  etapes: EtapeItem[];
}

export interface RelanceItem {
  id: number;
  canal: string;
  statut: string;
  actif: boolean;
  date_prevue: string | null;
  message: string | null;
  reprogrammations: number;
  escaladeAuto: boolean;
  escaladeLe: string | null;
  devis_id: number;
  devisNumero: string | null;
  clientNom: string | null;
}

export interface CreneauItem {
  id: number;
  date: string;
  heure: string;
  libelle: string;
  ville: string | null;
  chantier_id: number | null;
  /** Intervenant affecté au créneau, ou null si le créneau n'est pas encore attribué. */
  intervenant_id: number | null;
}

export interface FactureLigneItem {
  designation: string;
  unite: string;
  quantite: number;
  prix_unitaire: number;
  /** Taux de TVA de la ligne, en pourcentage. */
  taux_tva: number;
}

export interface FactureItem {
  id: number;
  numero: string;
  statut: string;
  total_ht: number;
  total_ttc: number;
  objet: string | null;
  date_emission: string | null;
  date_echeance: string | null;
  /** Date réelle du règlement (renseignée quand la facture est payée). */
  date_paiement: string | null;
  created_at: string;
  devis_id: number | null;
  devisNumero: string | null;
  client_id: number | null;
  clientNom: string | null;
  lignes: FactureLigneItem[] | null;
}

export interface EnvoiItem {
  id: number;
  facture_id: number | null;
  devis_id: number | null;
  relance_id: number | null;
  type: string;
  canal: string;
  groupe: boolean;
  /** Marqueur de provenance : « exemple » (jeu de démonstration) ou « reel » (envoi effectif). */
  mode: string | null;
  destinataire: string | null;
  sujet: string | null;
  created_at: string;
}

export interface EscaladeClientItem {
  nom: string;
  canal: string;
  numero: string | null;
  jours: number;
}

export interface EscaladeClientEchoueItem extends EscaladeClientItem {
  erreur: string;
}

export interface EscaladeJournalItem {
  id: number;
  run_at: string;
  examined: number;
  envoye: number;
  echoue: number;
  clients: EscaladeClientItem[];
  clientsEchoues: EscaladeClientEchoueItem[];
  relancesEchouees: number[];
}

interface ArtisanDataResult {
  loading: boolean;
  error: string | null;
  devis: DevisItem[];
  clients: ClientItem[];
  chantiers: ChantierItem[];
  relances: RelanceItem[];
  creneaux: CreneauItem[];
  factures: FactureItem[];
  envois: EnvoiItem[];
  escaladeJournal: EscaladeJournalItem[];
  /** Intervenants (membres de l'équipe) de l'entreprise. */
  intervenants: Intervenant[];
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
}

function firstEmbed(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as Record<string, unknown>) ?? null;
  return value as Record<string, unknown>;
}

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toNullableNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Convertit la copie JSONB des lignes d'une facture en lignes exploitables (ou null si absente). */
function parseFactureLignes(value: unknown): FactureLigneItem[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      designation: toStr(row.designation) ?? "",
      unite: toStr(row.unite) ?? "u",
      quantite: toNum(row.quantite),
      prix_unitaire: toNum(row.prix_unitaire),
      taux_tva: row.taux_tva === null || row.taux_tva === undefined ? 20 : toNum(row.taux_tva),
    };
  });
  return rows.length ? rows : null;
}

/** Convertit la copie JSONB des clients relancés d'un passage d'escalade. */
function parseEscaladeClients(value: unknown): EscaladeClientItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      nom: toStr(row.nom) ?? "Client",
      canal: toStr(row.canal) ?? "Email",
      numero: toStr(row.numero),
      jours: toNum(row.jours),
    };
  });
}

/** Convertit la copie JSONB des clients dont l'envoi a échoué lors d'un passage. */
function parseEscaladeClientsEchoues(value: unknown): EscaladeClientEchoueItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      nom: toStr(row.nom) ?? "Client",
      canal: toStr(row.canal) ?? "Email",
      numero: toStr(row.numero),
      jours: toNum(row.jours),
      erreur: toStr(row.erreur) ?? "Envoi impossible.",
    };
  });
}

/**
 * Charge toutes les données de l'artisan connecté (devis, clients, chantiers, relances, planning, factures).
 * RLS garantit côté base que seules les lignes de l'utilisateur courant sont renvoyées.
 */
export function useArtisanData(): ArtisanDataResult {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [devis, setDevis] = useState<DevisItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [chantiers, setChantiers] = useState<ChantierItem[]>([]);
  const [relances, setRelances] = useState<RelanceItem[]>([]);
  const [creneaux, setCreneaux] = useState<CreneauItem[]>([]);
  const [factures, setFactures] = useState<FactureItem[]>([]);
  const [envois, setEnvois] = useState<EnvoiItem[]>([]);
  const [escaladeJournal, setEscaladeJournal] = useState<EscaladeJournalItem[]>([]);
  const [intervenants, setIntervenants] = useState<Intervenant[]>([]);

  // `silent` : recharge les données sans basculer la page en état « chargement »
  // (sert au rafraîchissement automatique en arrière-plan, sans clignotement).
  const load = useCallback(async (silent = false) => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    // Un incident déjà consigné ne doit pas l'être deux fois (une fois par requête, une fois dans le catch).
    let incidentJournalise = false;
    try {
      const [devisRes, clientsRes, chantiersRes, relancesRes, etapesRes, creneauxRes, facturesRes] = await Promise.all([
        supabase
          .from("devis")
          .select("id, numero, objet, statut, total_ht, total_ttc, created_at, client_id, modele_cle, modele_nom, signed_at, clients(nom)")
          .order("created_at", { ascending: false }),
        supabase
          .from("clients")
          .select("id, nom, telephone, email, adresse, type, contact_nom, siret, secteur, notes, note_priorite, derniere_relance_at")
          .order("nom", { ascending: true }),
        supabase
          .from("chantiers")
          .select("id, libelle, adresse, statut, date_debut, montant, client_id, intervenant_id, clients(nom), created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("relances")
          .select("id, canal, statut, date_prevue, message, reprogrammations, escalade_auto, escalade_le, devis_id, devis(numero, client_id, clients(nom))")
          .order("date_prevue", { ascending: true }),
        supabase.from("etapes_chantier").select("id, chantier_id, libelle, fait").order("id", { ascending: true }),
        supabase
          .from("planning_creneaux")
          .select("id, date, heure, libelle, ville, chantier_id, intervenant_id")
          .order("date", { ascending: true }),
        supabase
          .from("factures")
          .select("id, numero, statut, total_ht, total_ttc, date_emission, date_echeance, date_paiement, created_at, devis_id, client_id, lignes")
          .order("created_at", { ascending: false }),
      ]);

      const envoisRes = await supabase
        .from("envois_email")
        .select("id, facture_id, devis_id, relance_id, type, canal, groupe, mode, destinataire, sujet, created_at")
        .order("created_at", { ascending: false });

      const journalRes = await supabase
        .from("escalade_journal")
        .select("id, run_at, examined, envoye, echoue, clients, clients_echoues, relances_echouees")
        .order("run_at", { ascending: false })
        .limit(30);

      const intervenantsList = await fetchIntervenants();

      // Contrôle explicite de chaque requête : le client Backend ne « lève » pas d'exception sur
      // une colonne ou une table invalide, il renvoie `{ data: null, error }`. Sans ce contrôle,
      // une carte retomberait silencieusement sur des données vides. On consigne chaque requête
      // en échec (avec sa table) puis on remonte la première pour basculer la page en erreur.
      const reponses: { table: string; error: unknown }[] = [
        { table: "devis", error: devisRes.error },
        { table: "clients", error: clientsRes.error },
        { table: "chantiers", error: chantiersRes.error },
        { table: "relances", error: relancesRes.error },
        { table: "etapes_chantier", error: etapesRes.error },
        { table: "planning_creneaux", error: creneauxRes.error },
        { table: "factures", error: facturesRes.error },
        { table: "envois_email", error: envoisRes.error },
        { table: "escalade_journal", error: journalRes.error },
      ];
      reponses.forEach((r) => {
        if (r.error) {
          incidentJournalise = true;
          journaliserDepuisErreur({ ecran: "Tableau de bord", source: r.table, error: r.error });
        }
      });

      if (devisRes.error) throw devisRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (chantiersRes.error) throw chantiersRes.error;
      if (relancesRes.error) throw relancesRes.error;
      if (creneauxRes.error) throw creneauxRes.error;
      if (facturesRes.error) throw facturesRes.error;
      if (envoisRes.error) throw envoisRes.error;
      if (journalRes.error) throw journalRes.error;

      const devisRows = (devisRes.data ?? []) as unknown as Array<Record<string, unknown>>;
      const clientRows = (clientsRes.data ?? []) as unknown as Array<Record<string, unknown>>;
      const chantierRows = (chantiersRes.data ?? []) as unknown as Array<Record<string, unknown>>;
      const relanceRows = (relancesRes.data ?? []) as unknown as Array<Record<string, unknown>>;
      const etapeRows = (etapesRes.data ?? []) as unknown as Array<Record<string, unknown>>;
      const creneauRows = (creneauxRes.data ?? []) as unknown as Array<Record<string, unknown>>;
      const factureRows = (facturesRes.data ?? []) as unknown as Array<Record<string, unknown>>;
      const envoiRows = (envoisRes.data ?? []) as unknown as Array<Record<string, unknown>>;
      const journalRows = (journalRes.data ?? []) as unknown as Array<Record<string, unknown>>;

      const etapesByChantier = new Map<number, EtapeItem[]>();
      etapeRows.forEach((row) => {
        const cid = toNum(row.chantier_id);
        const list = etapesByChantier.get(cid) ?? [];
        list.push({ id: toNum(row.id), libelle: toStr(row.libelle) ?? "", fait: Boolean(row.fait) });
        etapesByChantier.set(cid, list);
      });

      const clientNameById = new Map<number, string>();
      clientRows.forEach((row) => {
        clientNameById.set(toNum(row.id), toStr(row.nom) ?? "");
      });

      const devisById = new Map<number, { numero: string; objet: string | null }>();
      devisRows.forEach((row) => {
        devisById.set(toNum(row.id), { numero: toStr(row.numero) ?? "", objet: toStr(row.objet) });
      });

      setDevis(
        devisRows.map((row) => ({
          id: toNum(row.id),
          numero: toStr(row.numero) ?? "",
          objet: toStr(row.objet),
          statut: normalizeDevisStatut(toStr(row.statut)),
          total_ht: toNum(row.total_ht),
          total_ttc: toNum(row.total_ttc),
          created_at: toStr(row.created_at) ?? new Date().toISOString(),
          client_id: toNullableNum(row.client_id),
          clientNom: toStr(firstEmbed(row.clients)?.nom),
          modeleCle: toStr(row.modele_cle),
          modeleNom: toStr(row.modele_nom),
          signedAt: toStr(row.signed_at),
        })),
      );

      setClients(
        clientRows.map((row) => ({
          id: toNum(row.id),
          nom: toStr(row.nom) ?? "",
          telephone: toStr(row.telephone),
          email: toStr(row.email),
          adresse: toStr(row.adresse),
          type: toStr(row.type) ?? "particulier",
          contact_nom: toStr(row.contact_nom),
          siret: toStr(row.siret),
          secteur: toStr(row.secteur),
          notes: toStr(row.notes),
          note_priorite: toStr(row.note_priorite),
          derniere_relance_at: toStr(row.derniere_relance_at),
        })),
      );

      setChantiers(
        chantierRows.map((row) => {
          const id = toNum(row.id);
          return {
            id,
            libelle: toStr(row.libelle),
            adresse: toStr(row.adresse),
            statut: normalizeChantierStatut(toStr(row.statut)),
            date_debut: toStr(row.date_debut),
            montant: toNum(row.montant),
            client_id: toNullableNum(row.client_id),
            clientNom: toStr(firstEmbed(row.clients)?.nom),
            intervenant_id: toNullableNum(row.intervenant_id),
            etapes: etapesByChantier.get(id) ?? [],
          };
        }),
      );

      setRelances(
        relanceRows.map((row) => {
          const devisEmbed = firstEmbed(row.devis);
          return {
            id: toNum(row.id),
            canal: normalizeCanal(toStr(row.canal)),
            statut: toStr(row.statut) ?? "Programmée",
            actif: relanceIsActive(toStr(row.statut)),
            date_prevue: toStr(row.date_prevue),
            message: toStr(row.message),
            reprogrammations: toNum(row.reprogrammations),
            escaladeAuto: Boolean(row.escalade_auto),
            escaladeLe: toStr(row.escalade_le),
            devis_id: toNum(row.devis_id),
            devisNumero: toStr(devisEmbed?.numero),
            clientNom: toStr(firstEmbed(devisEmbed?.clients)?.nom),
          };
        }),
      );

      setCreneaux(
        creneauRows.map((row) => ({
          id: toNum(row.id),
          date: toStr(row.date) ?? "",
          heure: toStr(row.heure) ?? "08:00",
          libelle: toStr(row.libelle) ?? "",
          ville: toStr(row.ville),
          chantier_id: toNullableNum(row.chantier_id),
          intervenant_id: toNullableNum(row.intervenant_id),
        })),
      );

      setIntervenants(intervenantsList);

      setFactures(
        factureRows.map((row) => {
          const devisId = toNullableNum(row.devis_id);
          const clientId = toNullableNum(row.client_id);
          const devisInfo = devisId !== null ? devisById.get(devisId) : undefined;
          return {
            id: toNum(row.id),
            numero: toStr(row.numero) ?? "",
            statut: normalizeFactureStatut(toStr(row.statut)),
            total_ht: toNum(row.total_ht),
            total_ttc: toNum(row.total_ttc),
            objet: devisInfo?.objet ?? null,
            date_emission: toStr(row.date_emission),
            date_echeance: toStr(row.date_echeance),
            date_paiement: toStr(row.date_paiement),
            created_at: toStr(row.created_at) ?? new Date().toISOString(),
            devis_id: devisId,
            devisNumero: devisInfo?.numero ?? null,
            client_id: clientId,
            clientNom: clientId !== null ? clientNameById.get(clientId) ?? null : null,
            lignes: parseFactureLignes(row.lignes),
          };
        }),
      );

      setEnvois(
        envoiRows.map((row) => ({
          id: toNum(row.id),
          facture_id: toNullableNum(row.facture_id),
          devis_id: toNullableNum(row.devis_id),
          relance_id: toNullableNum(row.relance_id),
          type: toStr(row.type) ?? "facture",
          canal: normalizeCanal(toStr(row.canal)),
          groupe: Boolean(row.groupe),
          mode: toStr(row.mode),
          destinataire: toStr(row.destinataire),
          sujet: toStr(row.sujet),
          created_at: toStr(row.created_at) ?? new Date().toISOString(),
        })),
      );

      setEscaladeJournal(
        journalRows.map((row) => ({
          id: toNum(row.id),
          run_at: toStr(row.run_at) ?? "",
          examined: toNum(row.examined),
          envoye: toNum(row.envoye),
          echoue: toNum(row.echoue),
          clients: parseEscaladeClients(row.clients),
          clientsEchoues: parseEscaladeClientsEchoues(row.clients_echoues),
          relancesEchouees: Array.isArray(row.relances_echouees)
            ? (row.relances_echouees as unknown[]).map((v) => Number(v)).filter((v) => Number.isFinite(v))
            : [],
        })),
      );
    } catch (e) {
      // Un rafraîchissement silencieux qui échoue ne doit pas masquer la page déjà affichée,
      // ni déclencher deux fois le journal (déjà fait requête par requête ci-dessus).
      if (!incidentJournalise) {
        journaliserDepuisErreur({
          ecran: "Tableau de bord",
          source: "chargement global",
          error: e,
          gravite: silent ? "avertissement" : "blocage",
        });
      }
      if (!silent) setError("Impossible de charger vos données pour l'instant. Réessayez dans un instant.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user]);

  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    loading,
    error,
    devis,
    clients,
    chantiers,
    relances,
    creneaux,
    factures,
    envois,
    escaladeJournal,
    intervenants,
    reload: load,
    refresh,
  };
}