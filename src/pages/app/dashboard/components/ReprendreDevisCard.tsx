import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { lireDernierDevis, effacerDernierDevis, ancienneteDevisOuvert, type DernierDevisOuvert } from "@/lib/devisDernierOuvert";

/**
 * Carte « Reprendre » du tableau de bord : remet en avant le dernier devis ouvert
 * pour repartir en un clic, sans passer par le menu du compte.
 * Se masque d'elle-même s'il n'y a aucun devis récent mémorisé.
 */
export default function ReprendreDevisCard() {
  const navigate = useNavigate();
  const [devis, setDevis] = useState<DernierDevisOuvert | null>(null);

  useEffect(() => {
    setDevis(lireDernierDevis());
  }, []);

  if (!devis) return null;

  const libelle = devis.objet?.trim() || devis.numero;
  const anciennete = ancienneteDevisOuvert(devis.at);

  const oublier = () => {
    effacerDernierDevis();
    setDevis(null);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-accent-50 border border-accent-200 animate-fade-in">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-xl">
          <i className="ri-history-line"></i>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground-950">Reprendre là où vous en étiez</p>
          <p className="text-xs text-foreground-500 mt-0.5 truncate">
            Dernier devis ouvert : <strong className="text-foreground-800">{libelle}</strong>
            {devis.numero && devis.objet?.trim() ? ` · ${devis.numero}` : ""}
          </p>
          {anciennete && (
            <span className="mt-1.5 inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
              <i className="ri-time-line text-xs"></i>
              <span className="capitalize">{anciennete}</span>
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(`/app/devis?devis=${devis.id}`)}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
        >
          <i className="ri-arrow-right-up-line"></i>
          Reprendre
        </button>
        <button
          type="button"
          onClick={oublier}
          aria-label="Ne plus proposer ce devis"
          title="Ne plus proposer ce devis"
          className="w-9 h-9 flex items-center justify-center rounded-md text-accent-700 bg-background-50 border border-accent-200 hover:bg-accent-100 cursor-pointer"
        >
          <i className="ri-close-line"></i>
        </button>
      </div>
    </div>
  );
}