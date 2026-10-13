import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

/**
 * Note de synthèse / commentaire interne affiché en haut de la vue d'ensemble
 * Back-office. Une seule note partagée pour tout le back-office (table
 * `back_office_note`, ligne unique id = 1).
 *
 * Lecture : tout gestionnaire. Écriture : seulement le gestionnaire principal
 * (règles de sécurité côté Backend).
 */
export interface BackOfficeNoteState {
  note: string;
  updatedBy: string | null;
  updatedAt: string | null;
}

export function useBackOfficeNote() {
  const { user, isGestionnaire, isGestionnairePrincipal } = useAuth();
  const [note, setNote] = useState("");
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user || !isGestionnaire) {
      setNote("");
      setUpdatedBy(null);
      setUpdatedAt(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("back_office_note")
        .select("note, updated_by, updated_at")
        .eq("id", 1)
        .maybeSingle();
      if (err) throw err;
      const row = (data ?? null) as { note?: string | null; updated_by?: string | null; updated_at?: string | null } | null;
      setNote(row?.note ?? "");
      setUpdatedBy(row?.updated_by ?? null);
      setUpdatedAt(row?.updated_at ?? null);
    } catch {
      setError("Impossible de charger la note de synthèse pour l'instant.");
    } finally {
      setLoading(false);
    }
  }, [user, isGestionnaire]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (texte: string): Promise<{ error: string | null }> => {
      if (!isGestionnairePrincipal) return { error: "Seul le gestionnaire principal peut modifier la note." };
      setSaving(true);
      try {
        const propre = texte.trim();
        const { error: err } = await supabase
          .from("back_office_note")
          .upsert(
            {
              id: 1,
              note: propre || null,
              updated_by: user?.email ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          );
        if (err) throw err;
        setNote(propre);
        setUpdatedBy(user?.email ?? null);
        setUpdatedAt(new Date().toISOString());
        return { error: null };
      } catch {
        return { error: "L'enregistrement de la note a échoué." };
      } finally {
        setSaving(false);
      }
    },
    [isGestionnairePrincipal, user],
  );

  return {
    note,
    updatedBy,
    updatedAt,
    loading,
    error,
    saving,
    canEdit: isGestionnairePrincipal,
    isGestionnaire,
    reload: load,
    save,
  };
}