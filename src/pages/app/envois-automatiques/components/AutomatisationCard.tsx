import { useState } from "react";
import { Link } from "react-router-dom";
import type { AutoItem, AutoStatut } from "@/lib/envoisAutomatiques";
import { formatJour } from "@/lib/envoisAutomatiques";
import { capacitesEnvoiAuto, executerTestEnvoiAuto } from "@/lib/envoisAutomatiquesActions";
import ApercuEnvoiModal from "@/pages/app/envois-automatiques/components/ApercuEnvoiModal";

const STATUT_META: Record<
  AutoStatut,
  { label: string; icon: string; tone: string; bubble: string; dot: string }
> = {
  ok: {
    label: "À jour",
    icon: "ri-checkbox-circle-line",
    tone: "bg-accent-100 text-accent-800",
    bubble: "bg-accent-100 text-accent-700",
    dot: "bg-accent-500",
  },
  attention: {
    label: "À vérifier",
    icon: "ri-error-warning-line",
    tone: "bg-red-100 text-red-700",
    bubble: "bg-red-100 text-red-700",
    dot: "bg-red-500",
  },
  inactif: {
    label: "En pause",
    icon: "ri-pause-circle-line",
    tone: "bg-background-200 text-foreground-600",
    bubble: "bg-background-200 text-foreground-500",
    dot: "bg-background-300",
  },
  inconnu: {
    label: "Sans suivi",
    icon: "ri-question-line",
    tone: "bg-secondary-100 text-secondary-800",
    bubble: "bg-secondary-100 text-secondary-700",
    dot: "bg-secondary-500",
  },
};

/** Libellé court du dernier passage : date, ou message adapté si jamais passé. */
function dernierPassageTexte(item: AutoItem): string {
  if (item.dernierPassage) return formatJour(item.dernierPassage);
  if (!item.tracable) return "pas de suivi enregistré";
  if (!item.actif) return "—";
  return "jamais encore envoyé";
}

interface Props {
  item: AutoItem;
  /** Identifiant du profil connecté, pour les aperçus et les tests ciblés. */
  userId: string;
  /** Appelé après qu'un test a été lancé et journalisé, pour rafraîchir l'historique. */
  onTestEnregistre?: () => void;
}

export default function AutomatisationCard({ item, userId, onTestEnregistre }: Props) {
  const meta = STATUT_META[item.statut];
  const cap = capacitesEnvoiAuto(item.id);

  const [apercuOpen, setApercuOpen] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testNotice, setTestNotice] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handleTest = async () => {
    setTestLoading(true);
    setTestNotice(null);
    setTestError(null);
    const res = await executerTestEnvoiAuto(item.id, item.nom, userId);
    if (res.ok) setTestNotice(res.message);
    else setTestError(res.message);
    setTestLoading(false);
    onTestEnregistre?.();
  };

  const noteAction = !cap.test ? cap.raisonSansTest : !cap.apercu ? cap.raisonSansApercu : null;

  return (
    <div
      id={`auto-${item.id}`}
      className="flex flex-col gap-4 p-5 rounded-lg bg-background-100 border border-background-200 scroll-mt-6"
    >
      <div className="flex items-start gap-3">
        <span className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-xl ${meta.bubble}`}>
          <i className={item.icone}></i>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading font-semibold text-base text-foreground-950">{item.nom}</h3>
            <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-bold whitespace-nowrap ${meta.tone}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}></span>
              {meta.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-foreground-600 leading-relaxed">{item.description}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap">
          <i className="ri-repeat-line"></i>
          {item.frequence}
        </span>
        {item.enPause && (
          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-background-200 text-foreground-600 text-[11px] font-semibold whitespace-nowrap">
            <i className="ri-pause-line"></i>
            En pause (vacances)
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 rounded-md bg-background-50 border border-background-200">
          <p className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">Dernier envoi</p>
          <p className="mt-1 text-sm font-semibold text-foreground-950">{dernierPassageTexte(item)}</p>
          {item.dernierDetail && <p className="mt-0.5 text-[11px] text-foreground-500">{item.dernierDetail}</p>}
        </div>
        <div className="p-3 rounded-md bg-background-50 border border-background-200">
          <p className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">Prochain envoi</p>
          <p className="mt-1 text-sm font-semibold text-foreground-950">{item.prochaineLibelle}</p>
          <p className="mt-0.5 text-[11px] text-foreground-500">selon vos réglages</p>
        </div>
      </div>

      {item.note && (
        <p className="flex items-start gap-2 text-[11px] text-foreground-500 leading-relaxed">
          <i className="ri-information-line mt-px shrink-0"></i>
          <span>{item.note}</span>
        </p>
      )}

      {/* Aperçu de l'email + test réel (vers l'artisan uniquement) */}
      <div className="flex flex-wrap items-center gap-2">
        {cap.apercu && (
          <button
            type="button"
            onClick={() => setApercuOpen(true)}
            title="Voir l'email tel qu'il sera envoyé, sans rien expédier"
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 transition-colors"
          >
            <i className="ri-eye-line text-accent-600"></i>
            Aperçu de l'email
          </button>
        )}
        {cap.test ? (
          <button
            type="button"
            onClick={handleTest}
            disabled={testLoading}
            title="Envoyer un vrai email de test à votre propre adresse (marqué [Test])"
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {testLoading ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-flask-line"></i>}
            Tester maintenant
          </button>
        ) : (
          <span
            title={cap.raisonSansTest}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-background-100 border border-background-200 text-foreground-400 text-xs font-semibold whitespace-nowrap cursor-not-allowed"
          >
            <i className="ri-lock-line"></i>
            Test désactivé
          </span>
        )}
      </div>

      {noteAction && (
        <p className="flex items-start gap-2 text-[11px] text-foreground-400 leading-relaxed">
          <i className="ri-shield-check-line mt-px shrink-0"></i>
          <span>{noteAction}</span>
        </p>
      )}

      {testNotice && (
        <p className="flex items-start gap-2 text-[11px] text-accent-700 leading-relaxed">
          <i className="ri-checkbox-circle-line mt-px shrink-0"></i>
          <span>{testNotice}</span>
        </p>
      )}
      {testError && (
        <p className="flex items-start gap-2 text-[11px] text-red-600 leading-relaxed">
          <i className="ri-error-warning-line mt-px shrink-0"></i>
          <span>{testError}</span>
        </p>
      )}

      <Link
        to={item.lien}
        className="mt-auto inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-primary-100 text-primary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-200 transition-colors self-start"
      >
        <i className="ri-settings-3-line"></i>
        {item.lienLabel}
      </Link>

      {apercuOpen && (
        <ApercuEnvoiModal itemId={item.id} nom={item.nom} userId={userId} onClose={() => setApercuOpen(false)} />
      )}
    </div>
  );
}