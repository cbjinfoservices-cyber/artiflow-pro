import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";
import type { EscaladeJournalItem } from "@/hooks/useArtisanData";

/** Un point de l'historique du score de santé (une semaine). */
export interface SanteHistoriquePoint {
  /** Lundi de la semaine concernée (AAAA-MM-JJ). */
  semaine: string;
  /** Score de santé sur 100 pour cette semaine. */
  score: number;
  /** Score réellement enregistré (true) ou reconstruit depuis les données datées (false). */
  reel: boolean;
}

/** Nombre de semaines affichées dans l'historique du score. */
const NB_SEMAINES = 12;

/** Lundi (semaine commençant le lundi) de la semaine contenant `date`, au format AAAA-MM-JJ. */
function lundiISO(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const jour = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - jour);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Lundi de la semaine située `offset` semaines avant la semaine de `date`. */
function lundiDecale(date: Date, offset: number): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + offset * 7);
  return lundiISO(d);
}

/** Pénalité de score liée aux clients sans email (relances impossibles). */
function penaliteEmails(n: number): number {
  return Math.min(n * 8, 40);
}

/** Pénalité de score liée aux échecs d'envoi. */
function penaliteEchecs(n: number): number {
  return Math.min(n * 6, 30);
}

/** Pénalité de score liée à la régularité comptable. */
function penaliteCompta(n: number): number {
  return Math.min(n * 10, 30);
}

/**
 * Historique du score de « Santé du compte » sur les 12 dernières semaines.
 *
 * La semaine en cours est enregistrée en base (upsert idempotent, une ligne par semaine) :
 * c'est l'historique « réel » qui se construit visite après visite. Pour les semaines passées
 * encore absentes de la base, le score est reconstruit à partir des échecs d'envoi réellement
 * horodatés (journal d'escalade) et des pénalités courantes (emails, compta) comme référence.
 */
export function useSanteHistorique(params: {
  userId: string | null | undefined;
  /** Les données de base (clients, journal d'escalade) sont chargées. */
  ready: boolean;
  emailsManquants: number;
  echecs: number;
  moisManquants: number;
  /** Journal d'escalade daté, pour reconstruire les échecs des semaines passées. */
  escaladeJournal: EscaladeJournalItem[];
}): { points: SanteHistoriquePoint[]; loading: boolean; tendance: number | null } {
  const { userId, ready, emailsManquants, echecs, moisManquants, escaladeJournal } = params;
  const [stored, setStored] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Score courant, calculé exactement comme celui affiché dans le panneau.
  const scoreCourant = useMemo(() => {
    const penalite = penaliteEmails(emailsManquants) + penaliteEchecs(echecs) + penaliteCompta(moisManquants);
    return Math.max(0, Math.min(100, Math.round(100 - penalite)));
  }, [emailsManquants, echecs, moisManquants]);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const depuis = lundiDecale(new Date(), -(NB_SEMAINES - 1));
      const { data, error } = await supabase
        .from("sante_scores")
        .select("semaine, score")
        .eq("user_id", userId)
        .gte("semaine", depuis)
        .order("semaine", { ascending: true });
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((row) => {
        const item = row as { semaine: string; score: number };
        const cle = typeof item.semaine === "string" ? item.semaine.slice(0, 10) : String(item.semaine);
        map[cle] = Number(item.score);
      });
      setStored(map);
    } catch (e) {
      // L'historique est un confort : on continue avec la reconstruction, mais on consigne
      // l'incident (colonne/table en cause) pour ne pas laisser échouer la requête en silence.
      journaliserDepuisErreur({
        ecran: "Tableau de bord · Santé du compte",
        source: "sante_scores",
        error: e,
        gravite: "avertissement",
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Enregistre la semaine en cours (upsert idempotent) puis recharge l'historique.
  useEffect(() => {
    if (!userId || !ready) return undefined;
    let active = true;
    const semaine = lundiISO(new Date());
    const run = async () => {
      try {
        await supabase.from("sante_scores").upsert(
          {
            user_id: userId,
            semaine,
            score: scoreCourant,
            emails_manquants: emailsManquants,
            echecs,
            mois_manquants: moisManquants,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,semaine" },
        );
      } catch {
        /* best effort : le score reste affiché même si l'enregistrement échoue */
      }
      if (active) await fetchHistory();
    };
    void run();
    return () => {
      active = false;
    };
  }, [userId, ready, scoreCourant, emailsManquants, echecs, moisManquants, fetchHistory]);

  const points = useMemo(() => {
    const base = penaliteEmails(emailsManquants) + penaliteCompta(moisManquants);
    const now = new Date();
    const result: SanteHistoriquePoint[] = [];
    for (let i = NB_SEMAINES - 1; i >= 0; i -= 1) {
      const semaine = lundiDecale(now, -i);
      // Semaine en cours : on prend toujours le score réel du moment.
      if (i === 0) {
        result.push({ semaine, score: scoreCourant, reel: stored[semaine] !== undefined });
        continue;
      }
      // Semaine déjà enregistrée en base : on l'utilise telle quelle.
      if (stored[semaine] !== undefined) {
        result.push({ semaine, score: stored[semaine], reel: true });
        continue;
      }
      // Sinon, reconstruction à partir des échecs réellement horodatés cette semaine-là.
      const debut = new Date(`${semaine}T00:00:00`).getTime();
      const fin = debut + 7 * 86400000;
      const echecsSemaine = escaladeJournal.reduce((sum, run) => {
        const t = Date.parse(run.run_at);
        if (Number.isNaN(t) || t < debut || t >= fin) return sum;
        return sum + (run.echoue ?? 0);
      }, 0);
      const score = Math.max(0, Math.min(100, Math.round(100 - base - penaliteEchecs(echecsSemaine))));
      result.push({ semaine, score, reel: false });
    }
    return result;
  }, [stored, scoreCourant, emailsManquants, moisManquants, escaladeJournal]);

  const tendance = useMemo(() => {
    if (points.length < 2) return null;
    return points[points.length - 1].score - points[0].score;
  }, [points]);

  return { points, loading, tendance };
}