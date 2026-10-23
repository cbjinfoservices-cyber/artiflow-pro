import { useState } from "react";
import { Link } from "react-router-dom";
import { nouveautes } from "@/mocks/nouveautes";
import { cleArtiflow, ecrireBrut, lireTexte } from "@/lib/stockageLocal";

/** Les trois dernières livraisons du journal, la plus récente en tête. */
const dernieres = [...nouveautes].sort((a, b) => b.dateIso.localeCompare(a.dateIso)).slice(0, 3);

/** La dernière livraison, mise en avant dans le bandeau. */
const derniere = dernieres[0];

/** Clé de mémorisation : le visiteur ne revoit le bandeau qu'à la prochaine livraison. */
const CLE_MASQUE = cleArtiflow("tarifs", "quoiDeNeufMasque");

interface BandeauQuoiDeNeufTarifsProps {
  className?: string;
}

/**
 * Bandeau « Quoi de neuf » de la page Tarifs.
 *
 * Contrairement à celui de l'espace artisan, il s'adresse aux visiteurs : il présente la
 * dernière livraison, rappelle les deux précédentes et renvoie vers le journal complet.
 * Une fois fermé, il ne revient qu'à la sortie d'une nouvelle version — mémorisation locale
 * côté navigateur, distincte de celle des comptes artisans.
 */
export default function BandeauQuoiDeNeufTarifs({ className = "" }: BandeauQuoiDeNeufTarifsProps) {
  const [masque, setMasque] = useState(() => {
    const memorise = lireTexte(CLE_MASQUE).trim();
    return memorise === derniere.version;
  });

  if (masque) return null;

  const fermer = () => {
    ecrireBrut(CLE_MASQUE, derniere.version);
    setMasque(true);
  };

  return (
    <div className={`w-full rounded-lg border border-accent-200 bg-accent-50 ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 md:p-5">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-accent-500 text-background-50 text-lg">
            <i className="ri-megaphone-line"></i>
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-accent-800">Quoi de neuf</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold whitespace-nowrap">
                <i className="ri-git-commit-line"></i>v{derniere.version}
              </span>
              <span className="text-[11px] text-accent-800/80 whitespace-nowrap">{derniere.dateLabel}</span>
            </div>
            <p className="mt-1 text-sm md:text-base font-semibold text-accent-900 leading-snug">{derniere.title}</p>
            <p className="mt-0.5 text-xs md:text-sm text-accent-800/90 leading-relaxed">{derniere.summary}</p>

            {dernieres.length > 1 && (
              <ul className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                {dernieres.slice(1).map((n) => (
                  <li key={n.id} className="inline-flex items-center gap-1.5 text-[11px] text-accent-800/85">
                    <i className="ri-checkbox-blank-circle-fill text-[5px]"></i>
                    <span className="font-semibold whitespace-nowrap">v{n.version}</span>
                    <span className="truncate max-w-[220px]">{n.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {derniere.lien && (
            <Link
              to={derniere.lien}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
            >
              <i className="ri-eye-line"></i>
              Voir l'annonce
            </Link>
          )}
          <Link
            to="/nouveautes/recapitulatif"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-background-50 border border-accent-200 text-accent-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-accent-400 transition-colors"
          >
            <i className="ri-gallery-line"></i>
            Toutes les annonces
          </Link>
          <button
            type="button"
            onClick={fermer}
            title="Masquer jusqu'à la prochaine nouveauté"
            aria-label="Masquer le bandeau Quoi de neuf"
            className="w-9 h-9 flex items-center justify-center rounded-md text-accent-600 hover:bg-accent-100 cursor-pointer transition-colors"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      </div>
    </div>
  );
}