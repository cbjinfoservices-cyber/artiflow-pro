import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ClientItem, ChantierItem, DevisItem, FactureItem } from "@/hooks/useArtisanData";
import { useAuth } from "@/hooks/useAuth";
import { updateClientNotes } from "@/lib/artisanApi";
import { NOTE_PRIORITES, notePrioriteInfo } from "@/lib/notePriorites";
import { formatEuros } from "@/lib/format";
import { formatShortDate, todayISO } from "@/lib/dates";
import { RELANCE_CLIENT_DELAI_ALERTE, joursDepuisDerniereRelance } from "@/lib/relancesClient";
import { useRelancesClient } from "@/hooks/useRelancesClient";
import ScheduleRelanceModal from "@/pages/app/dashboard/components/ScheduleRelanceModal";
import { buildClientFichePdf, savePdf } from "@/lib/pdf";
import { buildBalanceAgeePdf } from "@/lib/comptabilitePdf";
import { computeBalanceAgee, isAvoir, type ComptaFacture } from "@/lib/exportComptable";

type Onglet = "devis" | "chantiers" | "factures";

interface ProDetailPanelProps {
  client: ClientItem;
  devis: DevisItem[];
  chantiers: ChantierItem[];
  factures: FactureItem[];
  onClose: () => void;
  onEdit: (client: ClientItem) => void;
  /** Signale au parent que les notes ont été enregistrées (rafraîchit la liste). */
  onClientSaved?: () => void;
}

/** Petite pastille de statut colorée selon la famille de statut du document. */
function statutTone(statut: string): string {
  const s = statut.toLowerCase();
  if (s.includes("sign") || s.includes("pay") || s.includes("termin") || s.includes("valid")) return "bg-accent-100 text-accent-800";
  if (s.includes("refus") || s.includes("annul") || s.includes("retard")) return "bg-red-100 text-red-700";
  if (s.includes("envoy") || s.includes("cours") || s.includes("émis") || s.includes("emis")) return "bg-secondary-100 text-secondary-800";
  if (s.includes("brouillon") || s.includes("programm")) return "bg-background-200 text-foreground-600";
  return "bg-primary-100 text-primary-800";
}

/**
 * Panneau latéral regroupant tous les documents d'un client professionnel :
 * ses devis, ses chantiers et ses factures, réunis au même endroit pour un
 * coup d'œil complet sans quitter la page.
 */
export default function ProDetailPanel({ client, devis, chantiers, factures, onClose, onEdit, onClientSaved }: ProDetailPanelProps) {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [onglet, setOnglet] = useState<Onglet>("devis");
  const [exporting, setExporting] = useState(false);
  const [balanceExporting, setBalanceExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [notes, setNotes] = useState(client.notes ?? "");
  const [notesDraft, setNotesDraft] = useState(client.notes ?? "");
  const [priorite, setPriorite] = useState(client.note_priorite ?? "");
  const [prioriteDraft, setPrioriteDraft] = useState(client.note_priorite ?? "");
  const [notesEditing, setNotesEditing] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [relanceNotice, setRelanceNotice] = useState<string | null>(null);
  const isPro = client.type === "professionnel";

  // Relances client programmées : pour proposer la programmation directement depuis la fiche.
  const { relances: relancesClient, reload: reloadRelancesClient } = useRelancesClient(user?.id ?? null);
  const relanceProgrammee = useMemo(() => {
    return (
      relancesClient
        .filter((r) => r.client_id === client.id && r.statut === "Programmée")
        .slice()
        .sort((a, b) => a.date_prevue.localeCompare(b.date_prevue))[0] ?? null
    );
  }, [relancesClient, client.id]);

  const handleRelanceSaved = async () => {
    await reloadRelancesClient();
    setRelanceNotice("Relance programmée. Elle partira automatiquement à la date choisie.");
    onClientSaved?.();
  };

  useEffect(() => {
    setNotes(client.notes ?? "");
    setNotesDraft(client.notes ?? "");
    setPriorite(client.note_priorite ?? "");
    setPrioriteDraft(client.note_priorite ?? "");
    setNotesEditing(false);
    setNotesError(null);
  }, [client.id, client.notes, client.note_priorite]);

  const proDevis = useMemo(() => devis.filter((d) => d.client_id === client.id), [devis, client.id]);
  const proChantiers = useMemo(() => chantiers.filter((c) => c.client_id === client.id), [chantiers, client.id]);
  const proFactures = useMemo(() => factures.filter((f) => f.client_id === client.id), [factures, client.id]);

  const totalDevis = useMemo(() => proDevis.reduce((s, d) => s + Number(d.total_ht || 0), 0), [proDevis]);
  const totalFacture = useMemo(() => proFactures.reduce((s, f) => s + Number(f.total_ttc || 0), 0), [proFactures]);
  const chantiersEnCours = useMemo(() => proChantiers.filter((c) => c.statut === "En cours").length, [proChantiers]);

  // Factures impayées du client (avoirs et factures réglées exclus), base de sa balance âgée.
  const impayes = useMemo(
    () => proFactures.filter((f) => !isAvoir(f.numero) && f.statut !== "Payée"),
    [proFactures],
  );

  const handleExportPdf = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const doc = await buildClientFichePdf({
        emetteur: {
          entreprise: profile?.entreprise ?? "",
          metier: profile?.metier ?? "",
          telephone: profile?.telephone ?? "",
          email: profile?.email ?? user?.email ?? "",
          logo: profile?.logo_url ?? null,
          siret: profile?.siret ?? null,
          tva: profile?.tva ?? null,
          assurance: profile?.assurance ?? null,
          penalitesRetard: profile?.penalites_retard ?? null,
        },
        client: {
          nom: client.nom,
          contact: client.contact_nom,
          secteur: client.secteur,
          siret: client.siret,
          adresse: client.adresse,
          telephone: client.telephone,
          email: client.email,
        },
        devis: proDevis.map((d) => ({
          numero: d.numero,
          objet: d.objet,
          dateLabel: formatShortDate(d.created_at),
          statut: d.statut,
          totalHT: d.total_ht,
        })),
        chantiers: proChantiers.map((c) => ({
          libelle: c.libelle,
          statut: c.statut,
          montant: c.montant,
          dateLabel: c.date_debut ? formatShortDate(c.date_debut) : "—",
        })),
        factures: proFactures.map((f) => ({
          numero: f.numero,
          statut: f.statut,
          dateLabel: formatShortDate(f.date_emission),
          totalTTC: f.total_ttc,
        })),
        totals: { caDevis: totalDevis, totalFacture, chantiersEnCours, chantiersTotal: proChantiers.length },
        notes,
        notesPriorite: priorite,
      });
      const slug = client.nom
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      savePdf(doc, `fiche-${slug || "client"}-${todayISO()}.pdf`);
    } catch {
      setExportError("L'export PDF a échoué. Réessayez.");
    } finally {
      setExporting(false);
    }
  };

  // Export PDF de la balance âgée de ce client : uniquement ses factures impayées,
  // réparties par ancienneté (0-30 / 30-60 / +60 j), sans passer par la Comptabilité.
  const handleExportBalance = () => {
    setExportError(null);
    setBalanceExporting(true);
    try {
      const list: ComptaFacture[] = impayes.map((f) => ({
        numero: f.numero,
        clientNom: f.clientNom,
        objet: f.objet,
        total_ht: f.total_ht,
        total_ttc: f.total_ttc,
        statut: f.statut,
        date_emission: f.date_emission,
        date_echeance: f.date_echeance,
        date_paiement: f.date_paiement,
        created_at: f.created_at,
      }));
      const balance = computeBalanceAgee(list);
      const ref = Date.now();
      const detail = list
        .map((f) => {
          const dateRef = f.date_echeance ?? f.date_emission ?? f.created_at;
          const t = dateRef ? new Date(dateRef).getTime() : NaN;
          const jours = Number.isNaN(t) ? 0 : Math.max(0, Math.floor((ref - t) / 86400000));
          return {
            numero: f.numero,
            client: f.clientNom ?? "",
            echeance: dateRef ?? null,
            jours,
            montant: Number(f.total_ttc || 0),
          };
        })
        .sort((a, b) => b.jours - a.jours);
      const doc = buildBalanceAgeePdf({
        emetteur: {
          entreprise: profile?.entreprise ?? "",
          metier: profile?.metier ?? "",
          telephone: profile?.telephone ?? "",
          email: profile?.email ?? user?.email ?? "",
          siret: profile?.siret ?? null,
          tva: profile?.tva ?? null,
        },
        filtreLabel: `Client : ${client.nom}`,
        balance,
        detail,
      });
      const slug = client.nom
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      savePdf(doc, `balance-agee-${slug || "client"}-${todayISO()}.pdf`);
    } catch {
      setExportError("L'export de la balance âgée a échoué. Réessayez.");
    } finally {
      setBalanceExporting(false);
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    setNotesError(null);
    try {
      const value = notesDraft.trim();
      await updateClientNotes(client.id, value, prioriteDraft || null);
      setNotes(value);
      setPriorite(prioriteDraft);
      setNotesEditing(false);
      onClientSaved?.();
    } catch {
      setNotesError("L'enregistrement des notes a échoué. Réessayez.");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleCancelNotes = () => {
    setNotesDraft(notes);
    setPrioriteDraft(priorite);
    setNotesEditing(false);
    setNotesError(null);
  };

  // Fermeture au clavier (Échap) pour une expérience panneau natif.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onglets: { id: Onglet; label: string; icon: string; count: number }[] = [
    { id: "devis", label: "Devis", icon: "ri-file-text-line", count: proDevis.length },
    { id: "chantiers", label: "Chantiers", icon: "ri-hammer-line", count: proChantiers.length },
    { id: "factures", label: "Factures", icon: "ri-receipt-line", count: proFactures.length },
  ];

  return (
    <>
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground-950/40" onClick={onClose}>
      <aside
        className="w-full sm:max-w-md h-full bg-background-50 border-l border-background-200 flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <header className="flex items-start justify-between gap-3 p-5 border-b border-background-200">
          <div className="flex items-start gap-3 min-w-0">
            <span className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-lg ${isPro ? "bg-accent-100 text-accent-700" : "bg-secondary-100 text-secondary-800"}`}>
              <i className={`${isPro ? "ri-building-2-line" : "ri-user-line"} text-xl`}></i>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-bold text-base text-foreground-950 truncate">{client.nom}</h2>
                <span
                  className={`shrink-0 inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold ${
                    isPro ? "bg-accent-100 text-accent-800" : "bg-secondary-100 text-secondary-800"
                  }`}
                >
                  {isPro ? "PRO" : "PARTICULIER"}
                </span>
              </div>
              <p className="text-[11px] text-foreground-500 truncate">
                {isPro
                  ? `${client.secteur ? `${client.secteur} · ` : ""}${client.contact_nom ?? "Interlocuteur à préciser"}`
                  : "Client particulier"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md hover:bg-background-200 cursor-pointer"
            aria-label="Fermer la fiche"
          >
            <i className="ri-close-line text-foreground-500"></i>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* Coordonnées */}
          <div className="flex flex-col gap-2 text-sm text-foreground-600">
            <span className="inline-flex items-center gap-2">
              <i className="ri-phone-line text-foreground-400"></i>
              {client.telephone ?? "—"}
            </span>
            <span className="inline-flex items-center gap-2">
              <i className="ri-mail-line text-foreground-400"></i>
              <span className="truncate">{client.email ?? "—"}</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <i className="ri-map-pin-line text-foreground-400"></i>
              <span className="truncate">{client.adresse ?? "—"}</span>
            </span>
            {client.siret && (
              <span className="inline-flex items-center gap-2">
                <i className="ri-bank-card-line text-foreground-400"></i>
                SIRET {client.siret}
              </span>
            )}
            {client.derniere_relance_at &&
              (() => {
                const jours = joursDepuisDerniereRelance(client.derniere_relance_at);
                const recent = jours !== null && jours < RELANCE_CLIENT_DELAI_ALERTE;
                return (
                  <span className={`inline-flex items-center gap-2 ${recent ? "text-red-600" : ""}`}>
                    <i className={recent ? "ri-alarm-warning-line" : "ri-history-line text-foreground-400"}></i>
                    Dernière relance le {formatShortDate(client.derniere_relance_at)}
                  </span>
                );
              })()}
          </div>

          {/* Indicateurs */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col p-3 rounded-lg bg-background-100 border border-background-200">
              <span className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">CA devis</span>
              <span className="font-heading font-bold text-base text-foreground-950">{formatEuros(totalDevis)}</span>
            </div>
            <div className="flex flex-col p-3 rounded-lg bg-background-100 border border-background-200">
              <span className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">Facturé</span>
              <span className="font-heading font-bold text-base text-foreground-950">{formatEuros(totalFacture)}</span>
            </div>
            <div className="flex flex-col p-3 rounded-lg bg-background-100 border border-background-200">
              <span className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">Chantiers</span>
              <span className="font-heading font-bold text-base text-foreground-950">
                {chantiersEnCours}
                <span className="text-[11px] font-medium text-foreground-500"> / {proChantiers.length}</span>
              </span>
            </div>
          </div>

          {/* Relance client programmée */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-background-100 border border-background-200">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                <i className="ri-calendar-schedule-line"></i>
                Relance client
              </span>
              <p className="text-sm text-foreground-700 mt-1 truncate">
                {relanceProgrammee
                  ? `Envoi prévu le ${formatShortDate(relanceProgrammee.date_prevue)}`
                  : "Aucune relance programmée"}
              </p>
              {relanceNotice && (
                <p className="text-[11px] text-accent-700 mt-1 inline-flex items-center gap-1">
                  <i className="ri-checkbox-circle-line"></i>
                  {relanceNotice}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setRelanceNotice(null);
                setScheduleOpen(true);
              }}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors shrink-0 ${
                relanceProgrammee
                  ? "bg-accent-100 text-accent-800 hover:bg-accent-200"
                  : "bg-primary-500 text-background-50 hover:bg-primary-600"
              }`}
            >
              <i className={relanceProgrammee ? "ri-edit-line" : "ri-add-line"}></i>
              {relanceProgrammee ? "Modifier" : "Programmer"}
            </button>
          </div>

          {/* Notes internes */}
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-secondary-50 border border-secondary-200">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-secondary-800 uppercase tracking-wide">
                <i className="ri-sticky-note-line"></i>
                Notes internes
              </span>
              {!notesEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setNotesDraft(notes);
                    setPrioriteDraft(priorite);
                    setNotesEditing(true);
                  }}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-semibold text-secondary-800 bg-background-50 border border-secondary-200 hover:border-secondary-400 cursor-pointer whitespace-nowrap transition-colors"
                >
                  <i className={notes ? "ri-edit-line" : "ri-add-line"}></i>
                  {notes ? "Modifier" : "Ajouter"}
                </button>
              )}
            </div>

            {notesEditing ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">Priorité</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPrioriteDraft("")}
                      className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full border text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        prioriteDraft === ""
                          ? "bg-foreground-900 border-foreground-900 text-background-50"
                          : "bg-background-50 border-secondary-200 text-foreground-600 hover:border-secondary-400"
                      }`}
                    >
                      <i className="ri-forbid-2-line"></i>
                      Aucune
                    </button>
                    {NOTE_PRIORITES.map((p) => {
                      const actif = prioriteDraft === p.key;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setPrioriteDraft(p.key)}
                          className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full border text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                            actif ? `${p.badge}` : "bg-background-50 border-secondary-200 text-foreground-600 hover:border-secondary-400"
                          }`}
                        >
                          <i className={p.icon}></i>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={3}
                  placeholder="Notes visibles uniquement par vous : préférences, historique, points de vigilance…"
                  className="px-3 py-2 rounded-md bg-background-50 border border-secondary-200 text-sm text-foreground-800 outline-none focus:border-secondary-400 resize-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold cursor-pointer hover:bg-secondary-600 whitespace-nowrap transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {savingNotes ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelNotes}
                    disabled={savingNotes}
                    className="h-8 px-3 rounded-md text-xs font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap disabled:opacity-60"
                  >
                    Annuler
                  </button>
                  {notesError && (
                    <span className="text-[11px] text-red-600 inline-flex items-center gap-1">
                      <i className="ri-error-warning-line"></i>
                      {notesError}
                    </span>
                  )}
                </div>
              </div>
            ) : notes ? (
              <div className="flex flex-col gap-1.5">
                {(() => {
                  const pr = notePrioriteInfo(priorite);
                  return pr ? (
                    <span className={`self-start inline-flex items-center gap-1 h-6 px-2.5 rounded-full border text-[10px] font-bold ${pr.badge}`}>
                      <i className={pr.icon}></i>
                      {pr.label}
                    </span>
                  ) : null;
                })()}
                <p className="text-sm text-foreground-700 whitespace-pre-line">{notes}</p>
              </div>
            ) : (
              <p className="text-xs text-foreground-500">Aucune note pour l'instant. Ajoutez-en pour garder le contexte (préférences, historique…).</p>
            )}
          </div>

          {/* Onglets */}
          <div className="flex gap-1 p-1 rounded-full bg-background-100 border border-background-200">
            {onglets.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOnglet(o.id)}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  onglet === o.id ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                <i className={o.icon}></i>
                {o.label}
                <span className={onglet === o.id ? "text-background-50/80" : "text-foreground-400"}>{o.count}</span>
              </button>
            ))}
          </div>

          {/* Devis */}
          {onglet === "devis" &&
            (proDevis.length === 0 ? (
              <p className="py-10 text-center text-sm text-foreground-500">Aucun devis pour cette entreprise.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {proDevis.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-background-100 border border-background-200">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground-950 truncate">{d.numero}</p>
                      <p className="text-[11px] text-foreground-500 truncate">
                        {d.objet ?? "Sans objet"} · {formatShortDate(d.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-sm font-bold text-foreground-950">{formatEuros(d.total_ht)}</span>
                      <span className={`inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold ${statutTone(d.statut)}`}>
                        {d.statut}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ))}

          {/* Chantiers */}
          {onglet === "chantiers" &&
            (proChantiers.length === 0 ? (
              <p className="py-10 text-center text-sm text-foreground-500">Aucun chantier pour cette entreprise.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {proChantiers.map((c) => {
                  const faites = c.etapes.filter((e) => e.fait).length;
                  const pct = c.etapes.length > 0 ? Math.round((faites / c.etapes.length) * 100) : null;
                  return (
                    <li key={c.id} className="flex flex-col gap-2 p-3 rounded-lg bg-background-100 border border-background-200">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground-950 truncate">{c.libelle ?? "Chantier"}</p>
                          <p className="text-[11px] text-foreground-500 truncate">
                            {c.adresse ?? "Adresse non renseignée"}
                            {c.date_debut ? ` · dès ${formatShortDate(c.date_debut)}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-sm font-bold text-foreground-950">{formatEuros(c.montant)}</span>
                          <span className={`inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold ${statutTone(c.statut)}`}>
                            {c.statut}
                          </span>
                        </div>
                      </div>
                      {pct !== null && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-background-200 overflow-hidden">
                            <div className="h-full rounded-full bg-accent-500" style={{ width: `${pct}%` }}></div>
                          </div>
                          <span className="text-[10px] text-foreground-500 whitespace-nowrap">
                            {faites}/{c.etapes.length} étapes
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ))}

          {/* Factures */}
          {onglet === "factures" &&
            (proFactures.length === 0 ? (
              <p className="py-10 text-center text-sm text-foreground-500">Aucune facture pour cette entreprise.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {proFactures.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-background-100 border border-background-200">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground-950 truncate">{f.numero}</p>
                      <p className="text-[11px] text-foreground-500 truncate">
                        Émise le {formatShortDate(f.date_emission)}
                        {f.date_echeance ? ` · éch. ${formatShortDate(f.date_echeance)}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-sm font-bold text-foreground-950">{formatEuros(f.total_ttc)}</span>
                      <span className={`inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold ${statutTone(f.statut)}`}>
                        {f.statut}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ))}
        </div>

        <footer className="p-5 border-t border-background-200 flex flex-col gap-2">
          {exportError && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <i className="ri-error-warning-line"></i>
              {exportError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportBalance}
              disabled={balanceExporting || impayes.length === 0}
              className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-md bg-background-50 border border-background-200 text-sm font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                impayes.length === 0
                  ? "Ce client n'a aucune facture impayée"
                  : "Exporter la balance âgée de ce client (ses factures impayées) en PDF"
              }
            >
              {balanceExporting ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-scales-3-line"></i>}
              Balance âgée
            </button>
            <button
              type="button"
              onClick={() => navigate(`/app/comptabilite?client=${client.id}`)}
              className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-md bg-background-50 border border-background-200 text-sm font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
              title="Ouvrir la comptabilité filtrée sur ce client"
            >
              <i className="ri-file-chart-line"></i>
              Journal comptable
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting}
              className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              title="Exporter la fiche (devis, chantiers, factures) en PDF"
            >
              {exporting ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-file-pdf-2-line"></i>}
              Exporter en PDF
            </button>
            <button
              type="button"
              onClick={() => onEdit(client)}
              className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-edit-line"></i>
              Modifier la fiche
            </button>
          </div>
        </footer>
      </aside>
    </div>
    {scheduleOpen && (
      <ScheduleRelanceModal
        client={client}
        existing={relanceProgrammee}
        onClose={() => setScheduleOpen(false)}
        onSaved={handleRelanceSaved}
      />
    )}
    </>
  );
}