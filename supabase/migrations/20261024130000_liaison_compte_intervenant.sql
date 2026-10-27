-- Liaison automatique fiche intervenant ↔ compte.
--
-- L'application relie un intervenant à son compte par l'email (colonne compte_email, renseignée
-- par l'artisan ou par la fonction rattachement-intervenant), alors que les règles d'accès
-- (planning, pointages, PV, fonction chantier_pour_intervenant) reconnaissent l'intervenant par
-- compte_id. Sans cette liaison, un intervenant ne voit ni sa fiche ni son planning.
--
-- compte_id est donc tenu à jour par la base :
--   - quand une fiche reçoit (ou change) son compte_email, si un compte existe déjà ;
--   - quand un compte est créé avec une adresse déjà déclarée sur une fiche.
-- Un compte ne peut être relié qu'à une seule fiche (contrainte d'unicité existante) : si l'adresse
-- est déjà reliée ailleurs, la fiche reste sans compte plutôt que de bloquer l'enregistrement.

CREATE OR REPLACE FUNCTION public.lier_compte_intervenant()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  compte uuid;
BEGIN
  IF NEW.compte_email IS NULL OR btrim(NEW.compte_email) = '' THEN
    NEW.compte_id := NULL;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND lower(NEW.compte_email) IS NOT DISTINCT FROM lower(OLD.compte_email) AND NEW.compte_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT u.id INTO compte
  FROM auth.users u
  WHERE lower(u.email) = lower(btrim(NEW.compte_email))
    AND u.id <> NEW.user_id
  LIMIT 1;
  IF compte IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.intervenants i WHERE i.compte_id = compte AND i.id IS DISTINCT FROM NEW.id
  ) THEN
    compte := NULL;
  END IF;
  NEW.compte_id := compte;
  RETURN NEW;
END $$;

CREATE TRIGGER intervenants_liaison_compte
  BEFORE INSERT OR UPDATE OF compte_email ON public.intervenants
  FOR EACH ROW EXECUTE FUNCTION public.lier_compte_intervenant();

-- Compte créé après la fiche : on relie la première fiche qui attend cette adresse.
CREATE OR REPLACE FUNCTION public.lier_nouveau_compte_intervenant()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email IS NULL OR EXISTS (SELECT 1 FROM public.intervenants WHERE compte_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  UPDATE public.intervenants
  SET compte_id = NEW.id
  WHERE id = (
    SELECT i.id FROM public.intervenants i
    WHERE lower(i.compte_email) = lower(NEW.email) AND i.compte_id IS NULL AND i.user_id <> NEW.id
    ORDER BY i.created_at, i.id
    LIMIT 1
  );
  RETURN NEW;
END $$;

CREATE TRIGGER intervenants_liaison_nouveau_compte
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.lier_nouveau_compte_intervenant();

REVOKE ALL ON FUNCTION public.lier_compte_intervenant(), public.lier_nouveau_compte_intervenant() FROM PUBLIC, anon, authenticated;

-- Fiches déjà présentes : même règle, appliquée une fois.
UPDATE public.intervenants SET compte_email = compte_email WHERE compte_email IS NOT NULL AND compte_id IS NULL;
