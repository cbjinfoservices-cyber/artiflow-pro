import { Link, useNavigate } from "react-router-dom";
import { useChantiersSansNouvelles } from "@/hooks/useChantiersSansNouvelles";

/** Nombre de clients silencieux à partir duquel le rappel s'affiche en haut du tableau de bord. */
export const SEUIL_ALERTE_SILENCIEUX = 3;

/**
 * Rappel affiché en haut du tableau de bord dès que plus de trois chantiers attendent des
 * nouvelles. Il donne les chantiers les plus silencieux et deux sorties immédiates :
 * la liste filtrée, ou l'envoi groupé d'un email à tous ces clients.
 */
export default function AlerteChantiersSilencieux() {
  const navigate = useNavigate();
  const { chantiers } = useChantiersSansNouvelles();

  if (chantiers.length <= SEUIL_ALERTE_SILENCIEUX) return null;

  const plusAncien = chantiers[0];

  return (
    <div className="rounded-lg bg-primary-50 border border-primary-200 p-4 flex flex-col sm:flex-row sm:items-start gap-3 animate-fade-in">
      <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-700">
        <i className="ri-alarm-warning-line text-lg"></i>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground-950">
          {chantiers.length} chantiers sans nouvelles depuis plus de 14 jours
        </p>
        <p className="mt-0.5 text-xs text-foreground-600">
          Vos clients attendent un signe de votre part. Le plus silencieux : <strong className="text-foreground-900">{plusAncien.libelle}</strong>{" "}
          ({plusAncien.jours} jours sans email).
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {chantiers.slice(0, 4).map((c) => (
            <li
              key={c.id}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-background-50 border border-primary-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap"
            >
              <i className="ri-building-2-line text-primary-600"></i>
              {c.libelle}
              <span className="text-primary-800 tabular-nums">· {c.jours} j</span>
            </li>
          ))}
          {chantiers.length > 4 && (
            <li className="inline-flex items-center h-6 px-2 rounded-full bg-primary-100 text-primary-900 text-[11px] font-semibold whitespace-nowrap">
              + {chantiers.length - 4}
            </li>
          )}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/app/chantiers?sans-nouvelles=1&nouvelles-groupees=1")}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-send-plane-line"></i>
            Envoyer un email groupé
          </button>
          <Link
            to="/app/chantiers?sans-nouvelles=1"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-primary-200 text-primary-900 text-xs font-semibold whitespace-nowrap hover:bg-primary-100 transition-colors"
          >
            <i className="ri-filter-3-line"></i>
            Voir ces chantiers
          </Link>
        </div>
      </div>
    </div>
  );
}