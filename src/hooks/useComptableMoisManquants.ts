import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";

/** Clé « AAAA-MM » à partir d'une date. */
function moisCle(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Libellé lisible d'une clé « AAAA-MM » (ex. « septembre 2026 »). */
export function moisManquantLabel(cle: string): string {
  const [y, m] = cle.split("-").map(Number);
  if (!y || !m) return cle;
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/**
 * Calcule la liste (clés « AAAA-MM ») des mois attendus restés sans envoi automatique
 * du journal comptable. Ne se déclenche que si l'envoi automatique mensuel ET l'alerte
 * « mois sans envoi » sont activés dans le profil. La logique reprend celle de l'alerte
 * de régularité : tout mois écoulé (hors mois en cours) posté au premier envoi automatique
 * mais jamais transmis est compté comme manquant.
 */
async function calculerMoisManquantsListe(userId: string): Promise<string[]> {
  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("comptable_auto_actif, comptable_relance_manquante_actif")
    .eq("id", userId)
    .maybeSingle();
  if (profErr) throw profErr;
  const p = (prof ?? {}) as {
    comptable_auto_actif?: boolean | null;
    comptable_relance_manquante_actif?: boolean | null;
  };
  if (!p.comptable_auto_actif || !p.comptable_relance_manquante_actif) return [];

  const { data: rows, error: rowsErr } = await supabase
    .from("envois_email")
    .select("created_at, mode")
    .eq("user_id", userId)
    .eq("type", "comptable");
  if (rowsErr) throw rowsErr;

  const autoMonths = new Set<string>();
  let premier: string | null = null;
  (rows ?? []).forEach((r) => {
    const row = r as Record<string, unknown>;
    if (String(row.mode ?? "").toLowerCase() !== "automatique") return;
    const d = new Date(String(row.created_at ?? ""));
    if (Number.isNaN(d.getTime())) return;
    const cle = moisCle(d);
    autoMonths.add(cle);
    if (premier === null || cle < premier) premier = cle;
  });
  if (autoMonths.size === 0 || premier === null) return [];

  const [fy, fm] = (premier as string).split("-").map(Number);
  const cleCourante = moisCle(new Date());
  const manquants: string[] = [];
  let y = fy;
  let m = fm + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  while (true) {
    const cle = `${y}-${String(m).padStart(2, "0")}`;
    if (cle >= cleCourante) break;
    if (!autoMonths.has(cle)) manquants.push(cle);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return manquants;
}

/**
 * Compteur léger des mois attendus restés sans envoi automatique du journal comptable,
 * utilisé pour la pastille du menu de navigation.
 */
export function useComptableMoisManquants(refreshKey?: string): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const liste = await calculerMoisManquantsListe(user.id);
        if (!cancelled) setCount(liste.length);
      } catch (e) {
        journaliserDepuisErreur({
          ecran: "Menu · Comptabilité",
          source: "profiles / envois_email",
          error: e,
          gravite: "avertissement",
        });
        if (!cancelled) setCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  return count;
}

/**
 * Variante enrichie : renvoie le nombre de mois manquants ET la liste de leurs libellés,
 * pour détailler la pastille « Comptabilité » au survol du menu latéral.
 */
export function useComptableMoisManquantsDetail(refreshKey?: string): { count: number; mois: string[] } {
  const { user } = useAuth();
  const [resultat, setResultat] = useState<{ count: number; mois: string[] }>({ count: 0, mois: [] });

  useEffect(() => {
    if (!user) {
      setResultat({ count: 0, mois: [] });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const liste = await calculerMoisManquantsListe(user.id);
        if (!cancelled) setResultat({ count: liste.length, mois: liste.map(moisManquantLabel) });
      } catch (e) {
        journaliserDepuisErreur({
          ecran: "Menu · Comptabilité",
          source: "profiles / envois_email",
          error: e,
          gravite: "avertissement",
        });
        if (!cancelled) setResultat({ count: 0, mois: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  return resultat;
}