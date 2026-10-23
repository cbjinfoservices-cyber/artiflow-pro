-- Détail d'un chantier pour un compte intervenant (application mobile, « Mon planning »).
--
-- Les intervenants n'ont pas accès aux tables chantiers / clients (données de l'entreprise).
-- Cette fonction leur renvoie uniquement ce qui sert sur le terrain — adresse, client à contacter,
-- note et étapes — et seulement pour un chantier auquel ils sont affectés : pilote du chantier ou
-- intervention planifiée sur ce chantier. Aucun montant, devis ni facture n'est exposé.

CREATE OR REPLACE FUNCTION public.chantier_pour_intervenant(p_chantier_id bigint)
RETURNS TABLE (
  id bigint,
  libelle text,
  adresse text,
  statut text,
  note text,
  client_nom text,
  client_contact text,
  client_telephone text,
  client_adresse text,
  etapes jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.libelle,
    c.adresse,
    c.statut,
    c.note,
    cl.nom,
    cl.contact_nom,
    cl.telephone,
    cl.adresse,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('libelle', e.libelle, 'fait', e.fait) ORDER BY e.id)
        FROM etapes_chantier e
        WHERE e.chantier_id = c.id
      ),
      '[]'::jsonb
    )
  FROM chantiers c
  LEFT JOIN clients cl ON cl.id = c.client_id AND cl.user_id = c.user_id
  WHERE c.id = p_chantier_id
    AND EXISTS (
      SELECT 1
      FROM intervenants i
      WHERE i.compte_id = auth.uid()
        AND i.actif
        AND i.user_id = c.user_id
        AND (
          c.intervenant_id = i.id
          OR EXISTS (
            SELECT 1 FROM planning_creneaux p
            WHERE p.chantier_id = c.id AND p.intervenant_id = i.id
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.chantier_pour_intervenant(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chantier_pour_intervenant(bigint) TO authenticated;
