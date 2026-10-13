import { useCallback, useState } from "react";
import {
  construireExportDonnees,
  type FormatExportDonnees,
} from "@/lib/exportDonneesPersonnelles";
import { telechargerBlob } from "@/lib/zip";
import { noterExportEffectue } from "@/lib/rappelExportMensuel";
import { ajouterExportHistorique } from "@/lib/historiqueExportsDonnees";

/** Récapitulatif d'un export réalisé (repris par l'interface pour la confirmation). */
export interface DernierExport {
  /** Nom du fichier téléchargé. */
  nom: string;
  /** Format produit. */
  format: FormatExportDonnees;
  /** Nombre de catégories (tables non vides) exportées. */
  tables: number;
  /** Nombre total de lignes exportées. */
  lignes: number;
  /** Taille de l'archive en octets. */
  taille: number;
  /** Date ISO de l'export. */
  date: string;
}

/**
 * Construit et télécharge une sauvegarde des données de l'artisan, puis :
 *  — repousse le rappel mensuel du tableau de bord (`noterExportEffectue`) ;
 *  — ajoute une entrée à l'historique des exports.
 *
 * Mutualise toute la logique d'export pour que le menu du compte, le tableau de bord et la page
 * Préférences se comportent exactement de la même façon.
 */
export function useExportDonnees() {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [dernier, setDernier] = useState<DernierExport | null>(null);

  const exporter = useCallback(async (format: FormatExportDonnees): Promise<DernierExport | null> => {
    setEnCours(true);
    setErreur(null);
    try {
      const res = await construireExportDonnees(format);
      if (res.tables === 0) {
        setErreur(
          "Aucune donnée à exporter pour l'instant. Dès que vous aurez des clients, devis ou factures, ils apparaîtront ici.",
        );
        return null;
      }
      const date = new Date().toISOString();
      const nom = `artiflow-mes-donnees-${format}-${date.slice(0, 10)}.zip`;
      telechargerBlob(nom, res.zip.blob);
      // Un export vient d'être fait : le rappel mensuel du tableau de bord est repoussé.
      noterExportEffectue();
      ajouterExportHistorique({
        date,
        format: res.format,
        tables: res.tables,
        lignes: res.lignes,
        taille: res.zip.size,
        nom,
      });
      const recap: DernierExport = {
        nom,
        format: res.format,
        tables: res.tables,
        lignes: res.lignes,
        taille: res.zip.size,
        date,
      };
      setDernier(recap);
      return recap;
    } catch (e) {
      setErreur(
        e instanceof Error ? `L'export a échoué : ${e.message}` : "L'export a échoué. Réessayez dans un instant.",
      );
      return null;
    } finally {
      setEnCours(false);
    }
  }, []);

  return { enCours, erreur, dernier, exporter };
}