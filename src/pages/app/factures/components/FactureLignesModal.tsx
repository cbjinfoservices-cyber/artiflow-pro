import { useEffect, useState } from "react";
import type { FactureItem, FactureLigneItem } from "@/hooks/useArtisanData";
import { fetchDevisLignes, normalizeTvaRate } from "@/lib/artisanApi";
import { designationDansBibliotheque } from "@/lib/bibliothequeLignes";
import { formatEuros } from "@/lib/format";
import { useEnregistrerLigneBibliotheque } from "@/hooks/useEnregistrerLigneBibliotheque";
import { useCategoriesEnregistrement } from "@/hooks/useCategoriesEnregistrement";
import { afficherCategorie } from "@/lib/categoriesLignesPrefs";
import { useCategoriesLignes } from "@/hooks/useCategoriesLignes";
import { useLignesBibliotheque } from "@/hooks/useLignesBibliotheque";
import Modal from "@/pages/app/components/Modal";
import EnregistrerLigneMenu from "@/pages/app/components/EnregistrerLigneMenu";
import DejaBibliothequeBadge from "@/pages/app/components/DejaBibliothequeBadge";
import Toast from "@/components/base/Toast";

/**
 * Fiche des lignes d'une facture : on y retrouve chaque désignation et on peut
 * l'enregistrer dans la bibliothèque (menu « Enregistrer dans… » pour choisir
 * la catégorie). Les lignes proviennent de la copie stockée sur la facture, ou
 * à défaut du devis d'origine.
 */
export default function FactureLignesModal({
  facture,
  userId,
  onClose,
}: {
  facture: FactureItem;
  userId: string | null;
  onClose: () => void;
}) {
  const [lignes, setLignes] = useState<FactureLigneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; tone: "ok" | "error" } | null>(null);
  const { enregistrer, enregistrerPlusieurs } = useEnregistrerLigneBibliotheque();
  const categories = useCategoriesEnregistrement(userId);
  const { prefs } = useCategoriesLignes();
  const { lignes: biblioLignes, reload: reloadBiblio } = useLignesBibliotheque(userId);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        if (facture.lignes && facture.lignes.length > 0) {
          if (active) setLignes(facture.lignes);
        } else if (facture.devis_id) {
          const rows = await fetchDevisLignes(facture.devis_id);
          if (active) {
            setLignes(
              rows.map((r) => ({
                designation: r.designation,
                unite: r.unite,
                quantite: r.quantite,
                prix_unitaire: r.prix_unitaire,
                taux_tva: normalizeTvaRate(r.taux_tva),
              })),
            );
          }
        } else if (active) {
          setLignes([]);
        }
      } catch {
        if (active) setLignes([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [facture]);

  const handleSave = async (index: number, categorie: string) => {
    const l = lignes[index];
    if (!l) return;
    if (!l.designation.trim()) {
      setToast({ tone: "error", message: "Cette ligne n'a pas de désignation à enregistrer." });
      return;
    }
    try {
      await enregistrer(
        {
          designation: l.designation,
          unite: l.unite,
          prix_unitaire: l.prix_unitaire,
          taux_tva: l.taux_tva,
        },
        categorie,
      );
      await reloadBiblio();
      setToast({ tone: "ok", message: `« ${l.designation.trim()} » enregistrée dans « ${afficherCategorie(categorie, prefs)} ».` });
    } catch {
      setToast({ tone: "error", message: "L'enregistrement dans la bibliothèque a échoué. Réessayez." });
    }
  };

  // Enregistre d'un coup toutes les désignations de la facture (en ignorant les doublons).
  const handleEnregistrerTout = async (categorie: string) => {
    const aEnregistrer = lignes
      .filter((l) => l.designation.trim() && !designationDansBibliotheque(biblioLignes, l.designation))
      .map((l) => ({
        designation: l.designation,
        unite: l.unite,
        prix_unitaire: l.prix_unitaire,
        taux_tva: l.taux_tva,
      }));
    if (aEnregistrer.length === 0) {
      setToast({ tone: "ok", message: "Toutes les lignes de cette facture sont déjà dans votre bibliothèque." });
      return;
    }
    try {
      const n = await enregistrerPlusieurs(aEnregistrer, categorie);
      await reloadBiblio();
      setToast({ tone: "ok", message: `${n} ligne(s) enregistrée(s) dans « ${afficherCategorie(categorie, prefs)} ».` });
    } catch {
      setToast({ tone: "error", message: "L'enregistrement des lignes a échoué. Réessayez." });
    }
  };

  return (
    <>
      <Modal
        title={`Lignes · ${facture.numero}`}
        subtitle="Enregistrez une désignation dans votre bibliothèque en choisissant sa catégorie."
        onClose={onClose}
        wide
      >
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <i className="ri-loader-4-line animate-spin text-xl text-primary-600"></i>
          </div>
        ) : lignes.length === 0 ? (
          <p className="py-8 text-center text-sm text-foreground-500">Aucune ligne détaillée pour cette facture.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-500">Lignes de la facture</p>
              <EnregistrerLigneMenu
                categories={categories}
                onSave={handleEnregistrerTout}
                label="Tout enregistrer"
              />
            </div>
            <div className="flex flex-col gap-2">
              {lignes.map((l, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-background-100 border border-background-200"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground-950 leading-snug">{l.designation}</p>
                    {designationDansBibliotheque(biblioLignes, l.designation) && (
                      <div className="mt-1">
                        <DejaBibliothequeBadge />
                      </div>
                    )}
                    <p className="text-[11px] text-foreground-500 mt-0.5">
                      {l.quantite} {l.unite} × {formatEuros(l.prix_unitaire)} · TVA{" "}
                      {String(l.taux_tva).replace(".", ",")} %
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-foreground-950 whitespace-nowrap hidden sm:block">
                    {formatEuros(l.quantite * l.prix_unitaire)}
                  </span>
                  <EnregistrerLigneMenu categories={categories} onSave={(categorie) => handleSave(i, categorie)} compact />
                </div>
              ))}
            </div>
          </>
        )}
        <p className="mt-3 text-[11px] text-foreground-400 flex items-center gap-1.5">
          <i className="ri-information-line"></i>
          Les lignes enregistrées se retrouvent dans « Bibliothèque de lignes » et se réutilisent dans vos devis.
        </p>
      </Modal>

      {toast && (
        <Toast
          message={toast.message}
          icon={toast.tone === "ok" ? "ri-bookmark-line" : "ri-error-warning-line"}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}