import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { todayISO } from "@/lib/dates";

/** Une ligne de facture telle qu'elle est figée sur la facture (copie JSONB). */
export interface LigneFactureEcheance {
  designation: string;
  unite: string;
  quantite: number;
  prix_unitaire: number;
  taux_tva: number;
}

/**
 * Une facture à encaisser, réduite au strict nécessaire pour un aperçu rapide
 * (sans recharger toute la page Factures).
 */
export interface FactureAEcheance {
  id: number;
  numero: string;
  statut: string;
  totalHt: number;
  totalTtc: number;
  dateEmission: string | null;
  /** Échéance la plus proche d'abord (liste triée à la source). */
  dateEcheance: string | null;
  clientNom: string | null;
  clientAdresse: string | null;
  clientTelephone: string | null;
  clientEmail: string | null;
  /** Copie des lignes stockée sur la facture, ou null si elle n'existe pas. */
  lignes: LigneFactureEcheance[] | null;
  /**
   * Horodatage du dernier rappel réellement envoyé pour cette facture (null si jamais relancée).
   * Sert de garde-fou : on ne relance pas deux fois le même client sans le voir.
   */
  dernierRappel: string | null;
}

/**
 * Échéances du jour, résumées pour la pastille du groupe « Aujourd'hui » de la barre latérale.
 * Volontairement léger (deux requêtes agrégées côté client) : c'est un simple indicateur, pas un
 * état métier. Toute erreur retombe sur des compteurs à zéro, jamais sur un écran bloqué.
 */
export interface EcheancesDuJour {
  /** Factures encore impayées dont l'échéance tombe aujourd'hui. */
  facturesJour: number;
  /** Factures impayées dont l'échéance est déjà dépassée (à encaisser en priorité). */
  facturesRetard: number;
  /** Montant TTC cumulé des factures ci-dessus (jour + retard). */
  montant: number;
  /** Relances client programmées qui partent aujourd'hui. */
  relancesJour: number;
  /** Les factures concernées, triées de l'échéance la plus ancienne à la plus récente. */
  factures: FactureAEcheance[];
}

/** État neutre, partagé par le rendu initial et les cas d'erreur. */
const VIDE: EcheancesDuJour = {
  facturesJour: 0,
  facturesRetard: 0,
  montant: 0,
  relancesJour: 0,
  factures: [],
};

interface LigneBrute {
  designation?: unknown;
  unite?: unknown;
  quantite?: unknown;
  prix_unitaire?: unknown;
  taux_tva?: unknown;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function txt(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

/** Convertit la copie JSONB des lignes d'une facture en lignes exploitables (ou null). */
function parserLignes(value: unknown): LigneFactureEcheance[] | null {
  if (!Array.isArray(value)) return null;
  const lignes = value.map((item) => {
    const row = (item ?? {}) as LigneBrute;
    return {
      designation: txt(row.designation) ?? "",
      unite: txt(row.unite) ?? "u",
      quantite: num(row.quantite),
      prix_unitaire: num(row.prix_unitaire),
      taux_tva: row.taux_tva === null || row.taux_tva === undefined ? 20 : num(row.taux_tva),
    };
  });
  return lignes.length ? lignes : null;
}

/**
 * Compte les échéances du jour : ce qu'il y a à encaisser et ce qui part tout seul.
 * `refreshKey` permet de rafraîchir les compteurs à chaque changement de page.
 */
export function useEcheancesDuJour(refreshKey?: string): EcheancesDuJour {
  const { user } = useAuth();
  const [echeances, setEcheances] = useState<EcheancesDuJour>(VIDE);

  useEffect(() => {
    if (!user) {
      setEcheances(VIDE);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const today = todayISO();

        // 1. Factures à encaisser : impayées, échéance aujourd'hui ou déjà passée.
        //    La liste détaillée sert à l'aperçu rapide déclenché depuis la pastille.
        const { data: factures } = await supabase
          .from("factures")
          .select("id, numero, statut, total_ht, total_ttc, date_emission, date_echeance, client_id, lignes")
          .eq("user_id", user.id)
          .neq("statut", "Payée")
          .not("date_echeance", "is", null)
          .lte("date_echeance", today)
          .order("date_echeance", { ascending: true });
        if (cancelled) return;

        const rows = (factures ?? []) as Array<Record<string, unknown>>;
        const facturesJour = rows.filter((f) => String(f.date_echeance ?? "") === today).length;
        const facturesRetard = rows.filter((f) => String(f.date_echeance ?? "") < today).length;
        const montant = rows.reduce((acc, f) => acc + num(f.total_ttc), 0);

        // 2. Coordonnées des clients concernés (une seule requête, uniquement s'il y a des factures).
        const clientIds = Array.from(
          new Set(rows.map((f) => num(f.client_id)).filter((id) => id > 0)),
        );
        const clientsParId = new Map<number, Record<string, unknown>>();
        if (clientIds.length > 0) {
          const { data: clients } = await supabase
            .from("clients")
            .select("id, nom, adresse, telephone, email")
            .in("id", clientIds);
          if (cancelled) return;
          ((clients ?? []) as Array<Record<string, unknown>>).forEach((c) => {
            clientsParId.set(num(c.id), c);
          });
        }

        // 3. Dernier rappel réellement envoyé, par facture (historique des relances de factures).
        //    Une seule requête, triée du plus récent au plus ancien : la première occurrence gagne.
        const factureIds = rows.map((f) => num(f.id)).filter((id) => id > 0);
        const dernierRappelParFacture = new Map<number, string>();
        if (factureIds.length > 0) {
          const { data: rappels } = await supabase
            .from("relance_facture_envois")
            .select("facture_id, envoye_le")
            .eq("user_id", user.id)
            .in("facture_id", factureIds)
            .order("envoye_le", { ascending: false });
          if (cancelled) return;
          ((rappels ?? []) as Array<Record<string, unknown>>).forEach((r) => {
            const id = num(r.facture_id);
            const le = txt(r.envoye_le);
            if (id > 0 && le && !dernierRappelParFacture.has(id)) {
              dernierRappelParFacture.set(id, le);
            }
          });
        }

        const liste: FactureAEcheance[] = rows.map((f) => {
          const clientId = num(f.client_id);
          const client = clientId > 0 ? clientsParId.get(clientId) : undefined;
          return {
            id: num(f.id),
            numero: txt(f.numero) ?? "",
            statut: txt(f.statut) ?? "Émise",
            totalHt: num(f.total_ht),
            totalTtc: num(f.total_ttc),
            dateEmission: txt(f.date_emission),
            dateEcheance: txt(f.date_echeance),
            clientNom: client ? txt(client.nom) : null,
            clientAdresse: client ? txt(client.adresse) : null,
            clientTelephone: client ? txt(client.telephone) : null,
            clientEmail: client ? txt(client.email) : null,
            lignes: parserLignes(f.lignes),
            dernierRappel: dernierRappelParFacture.get(num(f.id)) ?? null,
          };
        });

        // 4. Relances qui partent aujourd'hui.
        const { data: relances } = await supabase
          .from("relances_client")
          .select("id")
          .eq("user_id", user.id)
          .eq("statut", "Programmée")
          .eq("date_prevue", today);
        if (cancelled) return;

        setEcheances({
          facturesJour,
          facturesRetard,
          montant,
          relancesJour: (relances ?? []).length,
          factures: liste,
        });
      } catch {
        if (cancelled) return;
        setEcheances(VIDE);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  return echeances;
}