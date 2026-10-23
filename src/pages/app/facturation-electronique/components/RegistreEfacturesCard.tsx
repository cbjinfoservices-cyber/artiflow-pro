import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { FactureItem } from "@/hooks/useArtisanData";
import { formatEuros } from "@/lib/format";
import { formatShortDate } from "@/lib/dates";
import { EF_STATUTS, EF_STATUT_META, type EfStatut } from "@/lib/factureElectronique";
import type { EfHistoriqueEntree } from "@/lib/efactureHistorique";

/** Clé « AAAA-MM » d'une facture (date d'émission, sinon date de création). */
function cleMois(f: FactureItem): string {
  const base = f.date_emission ?? f.created_at.slice(0, 10);
  return base.slice(0, 7);
}

/** Libellé français d'un mois « AAAA-MM ». */
function libelleMois(cle: string): string {
  const [annee, mois] = cle.split("-").map((v) => Number(v));
  if (!annee || !mois) return cle;
  return new Date(annee, mois - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/** Date et heure courtes d'une entrée d'historique (« 12 oct. 14:32 »). */
function libelleDateHeure(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

interface Props {
  factures: FactureItem[];
  busyId: number | null;
  onPreparer: (f: FactureItem) => void;
  onTelechargerXml: (f: FactureItem) => void;
  onChangerStatut: (f: FactureItem, statut: EfStatut) => void;
  onRejeter: (f: FactureItem) => void;
  onApercuPdf: (f: FactureItem) => void;
  onExportCsv: () => void;
  /** Génère la fiche PDF des rejets affichés (période + liste), à imprimer ou envoyer. */
  onPdfRejets: (moisLabel: string, liste: FactureItem[]) => void;
  /** Ouvre la fenêtre d'envoi de la fiche des rejets au comptable par email. */
  onEnvoyerRejets: (moisLabel: string, liste: FactureItem[]) => void;
  /** Historique des changements d'étape, par facture (date, ancien motif, nouvelle étape). */
  historique?: Map<number, EfHistoriqueEntree[]>;
}

/**
 * Registre de suivi des factures électroniques : une ligne par facture, avec son
 * étape de cycle de vie et les actions disponibles (générer le XML, transmettre,
 * marquer comme reçue ou rejetée).
 */
export default function RegistreEfacturesCard({
  factures,
  busyId,
  onPreparer,
  onTelechargerXml,
  onChangerStatut,
  onRejeter,
  onApercuPdf,
  onExportCsv,
  onPdfRejets,
  onEnvoyerRejets,
  historique,
}: Props) {
  const [searchParams] = useSearchParams();
  // Factures dont le détail de l'historique est déplié (les autres restent compactes).
  const [histoOuverts, setHistoOuverts] = useState<number[]>([]);
  const basculerHistorique = (id: number) => {
    setHistoOuverts((liste) => (liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]));
  };
  // Un lien venu du tableau de bord peut arriver avec ?statut=rejetee : on ouvre
  // alors directement le registre sur les factures à corriger.
  const [filtre, setFiltre] = useState<string>(() => {
    const depuisUrl = searchParams.get("statut");
    return depuisUrl && (EF_STATUTS as readonly string[]).includes(depuisUrl) ? depuisUrl : "Toutes";
  });
  const [mois, setMois] = useState<string>("tous");
  const [query, setQuery] = useState("");

  // Mois présents dans le registre, du plus récent au plus ancien, avec leur volume.
  const moisDisponibles = useMemo(() => {
    const compteur = new Map<string, number>();
    factures.forEach((f) => {
      const cle = cleMois(f);
      compteur.set(cle, (compteur.get(cle) ?? 0) + 1);
    });
    return Array.from(compteur.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([cle, nombre]) => ({ cle, nombre }));
  }, [factures]);

  // Factures du mois sélectionné : c'est la base des compteurs affichés.
  const facturesDuMois = useMemo(
    () => (mois === "tous" ? factures : factures.filter((f) => cleMois(f) === mois)),
    [factures, mois],
  );

  const compteurs = useMemo(() => {
    const map: Record<string, number> = { Toutes: facturesDuMois.length };
    EF_STATUTS.forEach((s) => {
      map[s] = facturesDuMois.filter((f) => f.efacture_statut === s).length;
    });
    return map;
  }, [facturesDuMois]);

  // Compteur de rejets : nombre et montant TTC concerné, pour repérer d'un
  // coup d'œil les factures qui bloquent le circuit.
  const rejets = useMemo(
    () => facturesDuMois.filter((f) => f.efacture_statut === "rejetee"),
    [facturesDuMois],
  );
  const montantRejets = useMemo(
    () => rejets.reduce((somme, f) => somme + Number(f.total_ttc || 0), 0),
    [rejets],
  );

  const filtreActif = filtre !== "Toutes" || mois !== "tous" || query.trim() !== "";

  const reinitialiserFiltres = () => {
    setFiltre("Toutes");
    setMois("tous");
    setQuery("");
  };

  const liste = useMemo(() => {
    const q = query.trim().toLowerCase();
    return facturesDuMois.filter((f) => {
      const matchStatut = filtre === "Toutes" || f.efacture_statut === filtre;
      const matchQuery =
        !q ||
        f.numero.toLowerCase().includes(q) ||
        (f.clientNom ?? "").toLowerCase().includes(q) ||
        (f.objet ?? "").toLowerCase().includes(q);
      return matchStatut && matchQuery;
    });
  }, [facturesDuMois, filtre, query]);

  return (
    <section className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-col gap-3 px-5 py-4 border-b border-background-200">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-heading font-semibold text-sm text-foreground-950">Registre des factures</h3>
            <p className="text-xs text-foreground-500 mt-0.5">
              {liste.length} facture{liste.length > 1 ? "s" : ""} affichée{liste.length > 1 ? "s" : ""} · cycle de vie
              de chaque document{mois !== "tous" ? ` · ${libelleMois(mois)}` : ""}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltre("rejetee")}
              title={
                rejets.length === 0
                  ? "Aucune facture rejetée sur la période affichée"
                  : `${rejets.length} facture${rejets.length > 1 ? "s" : ""} rejetée${rejets.length > 1 ? "s" : ""} · ${formatEuros(montantRejets)} TTC — cliquez pour les isoler`
              }
              aria-label={`Compteur de rejets : ${rejets.length} facture${rejets.length > 1 ? "s" : ""} rejetée${rejets.length > 1 ? "s" : ""}`}
              className={`inline-flex items-center gap-2 h-9 px-3 rounded-md border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                rejets.length > 0
                  ? "bg-accent-100 border-accent-200 text-accent-900 hover:bg-accent-200"
                  : "bg-background-50 border-background-200 text-foreground-500 hover:border-accent-300"
              }`}
            >
              <i className="ri-error-warning-line"></i>
              <span className="tabular-nums">
                {rejets.length} rejet{rejets.length > 1 ? "s" : ""}
              </span>
              {rejets.length > 0 && (
                <span className="hidden sm:inline text-[11px] font-medium opacity-80 tabular-nums">
                  · {formatEuros(montantRejets)}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onEnvoyerRejets(mois === "tous" ? "Tous les mois" : libelleMois(mois), rejets)}
              disabled={rejets.length === 0}
              title={
                rejets.length === 0
                  ? "Aucune facture rejetée à envoyer sur la période affichée"
                  : `Envoyer la fiche des ${rejets.length} facture${rejets.length > 1 ? "s" : ""} rejetée${rejets.length > 1 ? "s" : ""} à votre comptable par email`
              }
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-mail-send-line"></i>
              Envoyer au comptable
            </button>
            <button
              type="button"
              onClick={() => onPdfRejets(mois === "tous" ? "Tous les mois" : libelleMois(mois), rejets)}
              disabled={rejets.length === 0}
              title={
                rejets.length === 0
                  ? "Aucune facture rejetée à imprimer sur la période affichée"
                  : `Imprimer ou envoyer la liste des ${rejets.length} facture${rejets.length > 1 ? "s" : ""} rejetée${rejets.length > 1 ? "s" : ""} (numéro, client, motif, montant)`
              }
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-printer-line"></i>
              PDF des rejets
            </button>
            <button
              type="button"
              onClick={onExportCsv}
              disabled={factures.length === 0}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Télécharger le registre complet au format CSV"
            >
              <i className="ri-file-excel-2-line"></i>
              Exporter le registre
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-50 border border-background-200 w-fit">
            <button
              type="button"
              onClick={() => setFiltre("Toutes")}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                filtre === "Toutes" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              Toutes ({compteurs.Toutes ?? 0})
            </button>
            {EF_STATUTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFiltre(s)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  filtre === s ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                {EF_STATUT_META[s].court} ({compteurs[s] ?? 0})
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:ml-auto">
            <div className="relative">
              <i className="ri-calendar-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
              <select
                id="mois-registre-ef"
                value={mois}
                onChange={(e) => setMois(e.target.value)}
                aria-label="Filtrer le registre par mois d'émission"
                title="Filtrer par mois d'émission"
                className="w-full sm:w-56 h-9 pl-9 pr-8 rounded-full bg-background-50 border border-background-200 text-xs text-foreground-800 outline-none focus:border-primary-400 cursor-pointer capitalize"
              >
                <option value="tous">Tous les mois ({factures.length})</option>
                {moisDisponibles.map((m) => (
                  <option key={m.cle} value={m.cle}>
                    {libelleMois(m.cle)} — {m.nombre} facture{m.nombre > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative sm:w-64">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher une facture…"
                aria-label="Rechercher une facture dans le registre"
                className="w-full h-9 pl-9 pr-3 rounded-full bg-background-50 border border-background-200 text-xs text-foreground-800 outline-none focus:border-primary-400"
              />
            </div>
          </div>
        </div>
      </div>

      {liste.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center px-5">
          <span className="w-12 h-12 flex items-center justify-center rounded-full bg-background-200 text-foreground-400">
            <i className="ri-file-code-line text-xl"></i>
          </span>
          <p className="text-sm text-foreground-600">
            {factures.length === 0
              ? "Aucune facture pour l'instant : générez d'abord une facture depuis un devis signé."
              : "Aucune facture ne correspond à ce filtre."}
          </p>
          {factures.length > 0 && filtreActif && (
            <button
              type="button"
              onClick={reinitialiserFiltres}
              className="mt-1 inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-300 transition-colors"
            >
              <i className="ri-refresh-line"></i>
              Réinitialiser les filtres
            </button>
          )}
          {factures.length === 0 && (
            <Link
              to="/app/factures"
              className="mt-1 inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap hover:bg-primary-600 transition-colors"
            >
              <i className="ri-add-line"></i>
              Aller aux factures
            </Link>
          )}
        </div>
      ) : (
        <ul>
          {liste.map((f) => {
            const meta = EF_STATUT_META[f.efacture_statut];
            const pret = f.efacture_statut !== "non_preparee";
            const histo = historique?.get(f.id) ?? [];
            const histoOuvert = histoOuverts.includes(f.id);
            return (
              <li
                key={f.id}
                className="flex flex-col gap-3 px-5 py-4 border-t border-background-200 hover:bg-background-50 transition-colors lg:flex-row lg:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-md ${
                        f.numero.startsWith("AV") ? "bg-accent-100 text-accent-700" : "bg-background-200 text-foreground-600"
                      }`}
                    >
                      <i className={`text-sm ${f.numero.startsWith("AV") ? "ri-refund-2-line" : "ri-receipt-line"}`}></i>
                    </span>
                    <span className="text-sm font-semibold text-foreground-950">{f.numero}</span>
                    {f.numero.startsWith("AV") && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-100 text-accent-700 font-semibold uppercase tracking-wide">
                        Avoir
                      </span>
                    )}
                    <span className="text-xs text-foreground-600 truncate">{f.clientNom ?? "Sans client"}</span>
                  </div>
                  <p className="text-[11px] text-foreground-400 mt-1">
                    Émise le {formatShortDate(f.date_emission)} · {formatEuros(f.total_ttc)} TTC
                    {f.efacture_transmis_le ? ` · transmise le ${formatShortDate(f.efacture_transmis_le.slice(0, 10))}` : ""}
                  </p>
                  {f.efacture_statut === "rejetee" && f.efacture_motif && (
                    <p className="mt-1 text-[11px] text-red-600 inline-flex items-start gap-1.5">
                      <i className="ri-error-warning-line mt-0.5"></i>
                      <span className="break-words">Motif du rejet : {f.efacture_motif}</span>
                    </p>
                  )}

                  {/* Historique des changements d'étape : date, ancien motif de rejet et nouvelle étape. */}
                  {histo.length > 0 && (
                    <div className="mt-1.5">
                      <button
                        type="button"
                        onClick={() => basculerHistorique(f.id)}
                        aria-expanded={histoOuvert}
                        title="Voir l'historique des retransmissions de cette facture"
                        className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-background-100 border border-background-200 text-[10px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:border-secondary-300 hover:text-foreground-900 transition-colors"
                      >
                        <i className="ri-history-line"></i>
                        Historique ({histo.length})
                        <i className={histoOuvert ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
                      </button>
                      {histoOuvert && (
                        <ol className="mt-1.5 flex flex-col gap-1 border-l border-background-300 pl-2.5">
                          {histo.map((h) => (
                            <li key={h.id} className="text-[10.5px] text-foreground-500 leading-relaxed">
                              <span className="inline-flex items-center gap-1.5 flex-wrap">
                                <i
                                  className={
                                    h.retransmission
                                      ? "ri-refresh-line text-accent-600"
                                      : "ri-arrow-right-line text-foreground-400"
                                  }
                                ></i>
                                <span className="font-semibold text-foreground-700">{libelleDateHeure(h.date)}</span>
                                <span className="text-foreground-400">·</span>
                                <span>{EF_STATUT_META[h.ancienneEtape].court}</span>
                                <i className="ri-arrow-right-s-line text-foreground-300"></i>
                                <span className="font-semibold text-foreground-800">
                                  {EF_STATUT_META[h.nouvelleEtape].label}
                                </span>
                                {h.retransmission && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[9px] font-bold uppercase tracking-wide">
                                    Retransmission
                                  </span>
                                )}
                              </span>
                              {h.ancienMotif && (
                                <span className="block pl-5 break-words text-foreground-400">
                                  Ancien motif : {h.ancienMotif}
                                </span>
                              )}
                              {h.nouveauMotif && (
                                <span className="block pl-5 break-words text-red-600">Nouveau motif : {h.nouveauMotif}</span>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <span
                    className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${meta.ton}`}
                    title={meta.aide}
                  >
                    <i className={meta.icone}></i>
                    {meta.label}
                  </span>

                  {f.efacture_statut === "rejetee" && (
                    <>
                      <button
                        type="button"
                        onClick={() => onChangerStatut(f, "preparee")}
                        disabled={busyId === f.id}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-60"
                        title="Corrigez la facture si nécessaire, puis ce bouton la repasse directement en « Prête à transmettre » et efface le motif de rejet."
                      >
                        {busyId === f.id ? (
                          <i className="ri-loader-4-line animate-spin"></i>
                        ) : (
                          <i className="ri-check-double-line"></i>
                        )}
                        Repasser prête
                      </button>
                      <Link
                        to={`/app/factures?q=${encodeURIComponent(f.numero)}`}
                        className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-accent-700 cursor-pointer"
                        aria-label={`Ouvrir la facture ${f.numero} pour corriger ses données`}
                        title="Ouvrir la facture pour corriger ses données"
                      >
                        <i className="ri-edit-line"></i>
                      </Link>
                    </>
                  )}

                  {!pret ? (
                    <button
                      type="button"
                      onClick={() => onPreparer(f)}
                      disabled={busyId === f.id}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60"
                      title="Générer le fichier XML Factur-X de cette facture"
                    >
                      {busyId === f.id ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-file-code-line"></i>}
                      Préparer le XML
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onTelechargerXml(f)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                      title="Télécharger le fichier XML Factur-X"
                    >
                      <i className="ri-download-2-line"></i>
                      XML
                    </button>
                  )}

                  <select
                    value={f.efacture_statut}
                    onChange={(e) => {
                      const valeur = e.target.value as EfStatut;
                      if (valeur === "rejetee") onRejeter(f);
                      else onChangerStatut(f, valeur);
                    }}
                    aria-label={`Changer l'étape de la facture ${f.numero}`}
                    title="Changer l'étape du cycle de vie"
                    className="h-8 px-2 rounded-md bg-background-50 border border-background-200 text-[11px] text-foreground-700 outline-none focus:border-primary-400 cursor-pointer"
                  >
                    {EF_STATUTS.map((s) => (
                      <option key={s} value={s}>
                        {EF_STATUT_META[s].label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => onApercuPdf(f)}
                    className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-primary-700 cursor-pointer"
                    aria-label={`Aperçu du PDF de la facture ${f.numero}`}
                    title="Aperçu du PDF (avec les mentions obligatoires)"
                  >
                    <i className="ri-eye-line"></i>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}