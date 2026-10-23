ALTER TABLE public.intervenants
  ADD COLUMN email text,
  ADD COLUMN compte_id uuid UNIQUE REFERENCES auth.users (id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX intervenants_user_email_unique_idx
  ON public.intervenants (user_id, lower(email))
  WHERE email IS NOT NULL;

CREATE POLICY "intervenants_select_own_or_assigned_account"
  ON public.intervenants
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR compte_id = (SELECT auth.uid()));

CREATE POLICY "intervenants_select_owner_or_assigned_only"
  ON public.intervenants
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR compte_id = (SELECT auth.uid()));

CREATE POLICY "planning_creneaux_select_own_or_assigned_intervenant"
  ON public.planning_creneaux
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.intervenants AS i
      WHERE i.id = planning_creneaux.intervenant_id
        AND i.user_id = planning_creneaux.user_id
        AND i.compte_id = (SELECT auth.uid())
        AND i.actif
    )
  );

CREATE POLICY "planning_creneaux_select_owner_or_assigned_only"
  ON public.planning_creneaux
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.intervenants AS i
      WHERE i.id = planning_creneaux.intervenant_id
        AND i.user_id = planning_creneaux.user_id
        AND i.compte_id = (SELECT auth.uid())
        AND i.actif
    )
  );

CREATE POLICY "intervenants_insert_owner_only"
  ON public.intervenants
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "intervenants_update_owner_only"
  ON public.intervenants
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "intervenants_delete_owner_only"
  ON public.intervenants
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "planning_creneaux_insert_owner_only"
  ON public.planning_creneaux
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "planning_creneaux_update_owner_only"
  ON public.planning_creneaux
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "planning_creneaux_delete_owner_only"
  ON public.planning_creneaux
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));
