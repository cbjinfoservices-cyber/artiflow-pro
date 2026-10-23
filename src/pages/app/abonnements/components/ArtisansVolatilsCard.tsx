import { useState } from "react";
import { formatEuros } from "@/lib/format";
import { formatShortDate, todayISO } from "@/lib/dates";
import { buildArtisansVolatilsPdf } from "@/lib/pdf";
import ApercuPdfModal from "@/components/feature/ApercuPdfModal";
import useApercuPdf from "@/hooks/useApercuPdf";
import { SEUIL_TRES_VOLATIL, type AbonnementItem, type AbonnementHistoriqueResume } from "@/lib/abonnementsApi";
import Toast from "@/components/base/Toast";
import RecontacterArtisanModal from "@/pages/app/abonnements/components/RecontacterArtisanModal";
import RecontacterTousModal, { type CibleRecontact } from "@/pages/app/abonnements/components/RecontacterTousModal";
import JournalRecontactsArtisan from "@/pages/app/abonnements/components/JournalRecontactsArtisan";

interface Props {
  abos: AbonnementItem[];
  resumes: Record<number, AbonnementHistoriqueResume>;
  onComparer: (ancienne: string, nouvelle: string, abonnementId: number) => void;
  /** Notifie l'appelant qu'un recontact vient d'être envoyé (rafraîchit la liste). */
  onRecontactEnvoye?: () => void;
}

const SEUIL_LABEL = `${SEUIL_TRES_VOLATIL}+ en 6 mois`;

interface RecontacterCible {
  abonnementId: number;
  entreprise: string;
  email: string | null;
  metier: string | null;
  ville: string | null;
  offre: string;
  nbChangements: number;
}

function offreTone(offre: string): string {
  if (offre === "Entreprise") return "bg-accent-100 text-accent-800";
  if (offre === "Pro") return "bg-primary-100 text-primary-800";
  return "bg-secondary-100 text-secondary-800";
}

const MEDAILLES = [
  "bg-accent-500 text-background-50",
  "bg-secondary-500 text-background-50",
  "bg-primary-500 text-background-50",
];

/**
 * Classement des artisans qui changent le plus souvent d'offre, établi à partir
 * du compteur de changements (résumé d'historique). Aide à repérer les comptes
 * les plus volatils, à les recontacter (un par un ou tous d'un clic), à consulter
 * le journal des recontacts envoyés et à exporter le classement en PDF.
 */
export default function ArtisansVolatilsCard({ abos, resumes, onComparer, onRecontactEnvoye }: Props) {
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { apercu: apercuPdf, ouvrirApercuPdf, fermerApercuPdf } = useApercuPdf();
  const [cible, setCible] = useState<RecontacterCible | null>(null);
  const [tousOpen, setTousOpen] = useState(false);
  const [journalOuvert, setJournalOuvert] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const rows = abos
    .map((a) => ({ abo: a, resume: resumes[a.id] }))
    .filter((r) => (r.resume?.offres ?? 0) > 0)
    .sort((x, y) => {
      const dy = (y.resume?.offres ?? 0) - (x.resume?.offres ?? 0);
      if (dy !== 0) return dy;
      return (y.resume?.total ?? 0) - (x.resume?.total ?? 0);
    })
    .slice(0, 6);

  const maxOffres = rows.length ? Math.max(...rows.map((r) => r.resume?.offres ?? 1)) : 1;
  const comptesConcernes = abos.filter((a) => (resumes[a.id]?.offres ?? 0) > 0).length;
  const tresVolatilsAll = abos.filter((a) => (resumes[a.id]?.offres6mois ?? 0) >= SEUIL_TRES_VOLATIL);
  const totalChangements = abos.reduce((s, a) => s + (resumes[a.id]?.offres ?? 0), 0);

  const ciblesTous: CibleRecontact[] = tresVolatilsAll.map((a) => ({
    abonnementId: a.id,
    entreprise: a.entreprise,
    email: a.email,
    nbChangements: resumes[a.id]?.offres6mois ?? 0,
  }));

  const handleExport = async () => {
    if (rows.length === 0) {
      setToast("Aucun artisan à exporter pour l'instant.");
      return;
    }
    setExporting(true);
    try {
      ouvrirApercuPdf({
        title: "Aperçu · Artisans les plus volatils",
        filename: `artisans-volatils-${todayISO()}.pdf`,
        note: `Classement des ${rows.length} comptes qui changent le plus d'offre · seuil ${SEUIL_LABEL}`,
        build: () =>
          buildArtisansVolatilsPdf({
            comptesConcernes,
            comptesTresVolatils: tresVolatilsAll.length,
            totalChangements,
            seuilLabel: SEUIL_LABEL,
            rows: rows.map((r, i) => {
              const derniere = r.resume?.recentes.find((it) => it.ancienne_valeur && it.nouvelle_valeur);
              return {
                rang: i + 1,
                entreprise: r.abo.entreprise,
                metier: r.abo.metier,
                ville: r.abo.ville,
                email: r.abo.email,
                offre: r.abo.offre,
                changements: r.resume?.offres ?? 0,
                dernierLabel:
                  derniere && derniere.ancienne_valeur
                    ? `${derniere.ancienne_valeur} → ${derniere.nouvelle_valeur ?? "—"}`
                    : null,
                dernierDate: derniere ? formatShortDate(derniere.created_at) : null,
                dernierMontant: derniere?.nouveau_montant ?? null,
              };
            }),
          }),
      });
    } catch {
      setToast("L'export PDF a échoué. Réessayez.");
    } finally {
      setExporting(false);
    }
  };

  const rafraichirJournaux = () => {
    setRefreshKey((k) => k + 1);
    onRecontactEnvoye?.();
  };

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5 min-w-0">
          <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide inline-flex items-center gap-1.5">
            <i className="ri-fire-line text-accent-600"></i>
            Artisans les plus volatils
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {comptesConcernes > 0 && (
              <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-bold whitespace-nowrap">
                {comptesConcernes} compte{comptesConcernes > 1 ? "s" : ""} concerné{comptesConcernes > 1 ? "s" : ""}
              </span>
            )}
            {tresVolatilsAll.length > 0 && (
              <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-bold whitespace-nowrap">
                <i className="ri-alert-line"></i>
                {tresVolatilsAll.length} à recontacter
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {tresVolatilsAll.length > 0 && (
            <button
              type="button"
              onClick={() => setTousOpen(true)}
              className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-[11px] font-bold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
              title="Envoyer le message de recontact à tous les comptes très volatils"
            >
              <i className="ri-send-plane-2-line"></i>
              Contacter tous
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || rows.length === 0}
            className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Exporter le classement complet en PDF"
          >
            {exporting ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-file-pdf-2-line"></i>}
            Export PDF
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="w-11 h-11 flex items-center justify-center rounded-full bg-background-200 text-foreground-400">
            <i className="ri-fire-line text-lg"></i>
          </span>
          <p className="text-sm text-foreground-600">Aucun artisan n'a encore changé d'offre.</p>
          <p className="text-[11px] text-foreground-400 max-w-[280px]">
            Dès qu'un passage d'offre est enregistré dans le back-office, il apparaîtra ici.
          </p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5 mt-1">
            {rows.map((r, i) => {
              const offres = r.resume?.offres ?? 0;
              const offres6mois = r.resume?.offres6mois ?? 0;
              const tresVolatil = offres6mois >= SEUIL_TRES_VOLATIL;
              const derniere = r.resume?.recentes.find((it) => it.ancienne_valeur && it.nouvelle_valeur);
              const pct = Math.round((offres / maxOffres) * 100);
              const journalOuvertRow = journalOuvert === r.abo.id;
              return (
                <li key={r.abo.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-[11px] font-bold ${
                        MEDAILLES[i] ?? "bg-background-200 text-foreground-600"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground-950 truncate">{r.abo.entreprise}</span>
                        <span className={`shrink-0 inline-flex items-center h-5 px-1.5 rounded-full text-[10px] font-bold ${offreTone(r.abo.offre)}`}>
                          {r.abo.offre}
                        </span>
                        {tresVolatil && (
                          <span className="shrink-0 inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold whitespace-nowrap">
                            <i className="ri-alert-line text-[10px]"></i>
                            Très volatil
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-foreground-500 truncate block">
                        {r.abo.metier ?? "Métier non renseigné"}
                        {r.abo.ville ? ` · ${r.abo.ville}` : ""}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-accent-700 whitespace-nowrap">
                      {offres} changement{offres > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pl-9">
                    <div className="flex-1 h-1.5 rounded-full bg-background-200 overflow-hidden">
                      <div className="h-full rounded-full bg-accent-500" style={{ width: `${pct}%` }}></div>
                    </div>
                    {derniere && (
                      <button
                        type="button"
                        onClick={() => onComparer(derniere.ancienne_valeur ?? "", derniere.nouvelle_valeur ?? "", r.abo.id)}
                        title={`Comparer ${derniere.ancienne_valeur} et ${derniere.nouvelle_valeur}`}
                        className="shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-md bg-secondary-100 text-secondary-800 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                      >
                        <i className="ri-arrow-left-right-line"></i>
                        Dernier : {derniere.ancienne_valeur} → {derniere.nouvelle_valeur}
                      </button>
                    )}
                    {tresVolatil && (
                      <button
                        type="button"
                        onClick={() =>
                          setCible({
                            abonnementId: r.abo.id,
                            entreprise: r.abo.entreprise,
                            email: r.abo.email,
                            metier: r.abo.metier,
                            ville: r.abo.ville,
                            offre: r.abo.offre,
                            nbChangements: offres6mois,
                          })
                        }
                        title="Recontacter ce compte très volatil"
                        className="shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-md bg-accent-500 text-background-50 text-[10px] font-bold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
                      >
                        <i className="ri-customer-service-2-line"></i>
                        Recontacter
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pl-9">
                    <button
                      type="button"
                      onClick={() => setJournalOuvert(journalOuvertRow ? null : r.abo.id)}
                      aria-expanded={journalOuvertRow}
                      className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-200 text-foreground-700 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-background-300 transition-colors"
                    >
                      <i className={journalOuvertRow ? "ri-arrow-up-s-line" : "ri-book-2-line"}></i>
                      Journal des recontacts
                    </button>
                    {derniere && (
                      <span className="text-[10px] text-foreground-400 truncate">
                        {formatShortDate(derniere.created_at)}
                        {derniere.nouveau_montant ? ` · ${formatEuros(derniere.nouveau_montant)}/mois` : ""}
                        {tresVolatil ? ` · ${offres6mois} changement${offres6mois > 1 ? "s" : ""} sur 6 mois` : ""}
                      </span>
                    )}
                  </div>
                  {journalOuvertRow && (
                    <div className="pl-9">
                      <JournalRecontactsArtisan abonnementId={r.abo.id} refreshKey={refreshKey} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-foreground-400 pt-2 border-t border-background-200">
            Classement par nombre de passages d'une offre à une autre (hors activation de compte). Les comptes à{" "}
            <strong className="font-semibold text-accent-700">{SEUIL_LABEL}</strong> sont signalés à recontacter.
          </p>
        </>
      )}

      {cible && (
        <RecontacterArtisanModal
          abonnementId={cible.abonnementId}
          entreprise={cible.entreprise}
          email={cible.email}
          metier={cible.metier}
          ville={cible.ville}
          offre={cible.offre}
          nbChangements={cible.nbChangements}
          seuilLabel={SEUIL_LABEL}
          onClose={() => setCible(null)}
          onSent={rafraichirJournaux}
        />
      )}
      {tousOpen && (
        <RecontacterTousModal
          cibles={ciblesTous}
          seuilLabel={SEUIL_LABEL}
          onClose={() => setTousOpen(false)}
          onSent={rafraichirJournaux}
        />
      )}
      {apercuPdf && (
        <ApercuPdfModal
          title={apercuPdf.title}
          subtitle={apercuPdf.subtitle}
          filename={apercuPdf.filename}
          docBuilder={apercuPdf.build}
          note={apercuPdf.note}
          onClose={fermerApercuPdf}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}