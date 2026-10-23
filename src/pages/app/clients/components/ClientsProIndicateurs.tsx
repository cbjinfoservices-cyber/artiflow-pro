import { formatEuros } from "@/lib/format";
import type { ChantierItem, ClientItem, DevisItem } from "@/hooks/useArtisanData";

interface Props {
  pros: ClientItem[];
  devis: DevisItem[];
  chantiers: ChantierItem[];
  onVoirTous: () => void;
}

/**
 * Bandeau affiché quand le carnet est filtré sur « Professionnels ».
 *
 * Il rappelle que cette vue n'est pas un second carnet, puis résume ce qui compte côté
 * entreprises : combien, combien elles ont généré, combien de devis et de chantiers ouverts.
 */
export default function ClientsProIndicateurs({ pros, devis, chantiers, onVoirTous }: Props) {
  const caDe = (id: number) => devis.filter((d) => d.client_id === id).reduce((sum, d) => sum + Number(d.total_ht || 0), 0);
  const totalCa = pros.reduce((sum, c) => sum + caDe(c.id), 0);
  const nbDevis = devis.filter((d) => d.client_id !== null && pros.some((p) => p.id === d.client_id)).length;
  const chantiersEnCours = chantiers.filter(
    (ch) => ch.client_id !== null && pros.some((p) => p.id === ch.client_id) && ch.statut === "En cours",
  ).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg bg-accent-50 border border-accent-200">
        <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <i className="ri-building-2-line"></i>
        </span>
        <p className="text-xs text-foreground-700 min-w-0 flex-1">
          <strong className="text-foreground-950">Vue professionnels du carnet.</strong> Ce ne sont pas des fiches à part : ce sont vos
          clients entreprises, avec l'interlocuteur, le secteur, le SIRET et le chiffre d'affaires généré.
        </p>
        <button
          type="button"
          onClick={onVoirTous}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
        >
          <i className="ri-contacts-book-2-line"></i>
          Voir tout le carnet
        </button>
      </div>

      <p className="inline-flex items-start gap-1.5 text-[11px] text-foreground-500">
        <i className="ri-pushpin-2-line text-accent-600 mt-0.5"></i>
        <span>
          Cette vue s'épingle : avec le bouton « Épingler » de l'en-tête, elle se range dans vos vues favorites et se
          rouvre en un clic depuis le tableau de bord.
        </span>
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
            <i className="ri-building-2-line text-accent-600"></i> Professionnels
          </span>
          <span className="font-heading font-bold text-2xl text-foreground-950">{pros.length}</span>
          <span className="text-[11px] text-foreground-500">entreprises enregistrées</span>
        </div>
        <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
            <i className="ri-money-euro-circle-line text-primary-600"></i> CA généré
          </span>
          <span className="font-heading font-bold text-2xl text-foreground-950">{formatEuros(totalCa)}</span>
          <span className="text-[11px] text-foreground-500">devis liés à ces entreprises</span>
        </div>
        <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
            <i className="ri-file-text-line text-secondary-600"></i> Devis émis
          </span>
          <span className="font-heading font-bold text-2xl text-foreground-950">{nbDevis}</span>
          <span className="text-[11px] text-foreground-500">toutes entreprises confondues</span>
        </div>
        <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
            <i className="ri-hammer-line text-accent-600"></i> Chantiers en cours
          </span>
          <span className="font-heading font-bold text-2xl text-foreground-950">{chantiersEnCours}</span>
          <span className="text-[11px] text-foreground-500">chez ces clients</span>
        </div>
      </div>
    </div>
  );
}