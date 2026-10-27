-- Lien manquant dans la description API de Readdy : une reprogrammation appartient à une relance.
-- Le récap quotidien (recap-quotidien) lit les reprogrammations avec leur relance et leur devis
-- en une seule requête, ce qui exige ce lien.
ALTER TABLE public.relance_reprogrammations
  ADD CONSTRAINT relance_reprogrammations_relance_id_fkey FOREIGN KEY (relance_id) REFERENCES public.relances (id);
