import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { libelleDans, type ExecutionImminente } from "@/lib/envoisAutomatiques";
import type { ChantierSansNouvellesItem } from "@/hooks/useChantiersSansNouvelles";
import type { EchecEnvoiClient } from "@/hooks/useEchecsEnvoisClients";
import type { RecapMoisOublie, RecapReport } from "@/hooks/useRecapMoisOublie";
import { renvoyerEmailClientEnEchec } from "@/lib/suiviChantier";
import {
  RENVOIS_CLOCHE_EVENT,
  ajouterRenvoiCloche,
  lireRenvoisCloche,
  viderRenvoisCloche,
  type RenvoiCloche,
} from "@/lib/renvoisClocheMemoire";
import {
  RENVOIS_PROGRAMMES_EVENT,
  annulerRenvoiProgramme,
  annulerTousRenvoisProgrammes,
  libelleDecompteRenvoi,
  libelleEcheanceRenvoi,
  lireRenvoisProgrammes,
  programmerRenvoi,
  type RenvoiProgramme,
} from "@/lib/renvoisProgrammesMemoire";
import {
  annulerSnoozeRecap,
  lireDureeSnoozePreferee,
  memoriserDureeSnooze,
  snoozerRecapOublie,
  type DureeSnoozeRecap,
} from "@/lib/recapOublieSnooze";
import { FENETRES_IMMINENTES_MIN, type FenetreImminenteMin } from "@/lib/imminencePrefsMemoire";
import type { ImminencePrefs } from "@/hooks/useImminencePrefs";
import type { NotificationImminente } from "@/hooks/useNotificationImminente";
import { useQuoiDeNeuf } from "@/hooks/useQuoiDeNeuf";
import { useJournalImminentes } from "@/hooks/useJournalImminentes";
import type { EntreeJournalImminent } from "@/lib/journalImminentesMemoire";
import { formatEuros } from "@/lib/format";
import { savePdf } from "@/lib/pdf";
import { buildRejetsEfacturePdf } from "@/lib/rejetsEfacturePdf";
import Modal from "@/pages/app/components/Modal";

/** Horodatage court et lisible d'une ligne du journal (« 12 oct. 14:32 »). */
function formatHorodatage(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Libellé d'une fenêtre d'alerte (« 60 min (1 h) »). */
function libelleFenetre(min: FenetreImminenteMin): string {
  return min === 60 ? "60 min (1 h)" : `${min} min`;
}

/** Date de retour d'un report d'alerte (« 30 octobre 2026 »). */
function formatDateReport(date: Date): string {
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export interface RejetCloche {
  id: number;
  numero: string;
  clientNom: string | null;
  motif: string | null;
  totalTtc: number;
}

/**
 * Cloche de l'en-tête : elle réunit les factures électroniques rejetées et les traitements
 * imminents. Un clic ouvre une infobulle qui affiche les rejets (correction directe, PDF),
 * le réglage de la fenêtre d'alerte (15 / 30 / 60 min), la bascule de la notification
 * navigateur, les traitements qui entrent dans la fenêtre (avec exclusion unitaire),
 * les automatisations exclues (réactivables) et le journal local des signalements envoyés.
 */
export default function ClocheImminents({
  executions,
  prefs,
  notif,
  rejets = [],
  sansNouvelles = [],
  echecs = [],
  recapOublie = null,
  recapReport = null,
  autoNouvellesActif = null,
  entreprise = null,
  onReloadEchecs,
}: {
  executions: ExecutionImminente[];
  prefs: ImminencePrefs;
  notif: NotificationImminente;
  rejets?: RejetCloche[];
  /** Chantiers dont le client n'a plus de nouvelles depuis 14 jours ou plus. */
  sansNouvelles?: ChantierSansNouvellesItem[];
  /** Dernier email client refusé par le service d'envoi, par chantier. */
  echecs?: EchecEnvoiClient[];
  /** Récap mensuel resté en plan (date dépassée, ni envoyé ni archivé). */
  recapOublie?: RecapMoisOublie | null;
  /** Report actif de l'alerte récap : affiché en bandeau annulable. */
  recapReport?: RecapReport | null;
  /** L'envoi groupé automatique des nouvelles est-il activé ? (null = inconnu) */
  autoNouvellesActif?: boolean | null;
  entreprise?: string | null;
  /** Recharge la liste des emails en échec après un renvoi. */
  onReloadEchecs?: () => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [journalModal, setJournalModal] = useState(false);
  const zoneRef = useRef<HTMLDivElement>(null);
  const { entrees, vider } = useJournalImminentes();
  // Dernière livraison du journal et reste à lire : la cloche relaie l'annonce directement,
  // sans obliger à passer par le menu puis la page Nouveautés.
  const { derniere, nombreNonLues, marquerToutVu } = useQuoiDeNeuf();
  // Renvoi direct d'un email en échec depuis la cloche, sans quitter la page.
  const [renvoiEnCours, setRenvoiEnCours] = useState<number | null>(null);
  const [renvois, setRenvois] = useState<Record<number, { ok: boolean; texte: string }>>({});
  // Historique des renvois effectués depuis la cloche : date, destinataire, résultat.
  const [historiqueRenvois, setHistoriqueRenvois] = useState<RenvoiCloche[]>(() => lireRenvoisCloche());
  // Renvois différés (« renvoyer dans 24 h ») : l'adresse visée est mémorisée pour annuler
  // le renvoi si la fiche client a été corrigée entre-temps.
  const [programmes, setProgrammes] = useState<RenvoiProgramme[]>(() => lireRenvoisProgrammes());
  const traiteProgramme = useRef<Set<number>>(new Set());
  // Horloge locale : elle fait vivre le décompte avant chaque départ de renvoi programmé.
  const [maintenant, setMaintenant] = useState(() => Date.now());
  // Confirmation en deux temps avant d'annuler d'un coup tous les renvois prévus.
  const [confirmeAnnulationGroupe, setConfirmeAnnulationGroupe] = useState(false);
  // Renvoi groupé de toutes les adresses refusées : progression pendant la file d'envoi.
  const [renvoiGroupe, setRenvoyGroupe] = useState<{ fait: number; total: number } | null>(null);
  // Bilan chiffré en fin de renvoi groupé : combien sont partis, combien restent refusés.
  // Les échecs restants sont conservés pour pouvoir ne relancer qu'eux.
  const [bilanGroupe, setBilanGroupe] = useState<{
    envoyes: number;
    refuses: EchecEnvoiClient[];
  } | null>(null);
  // Confirmation en deux temps avant d'oublier l'historique des renvois.
  const [confirmeOubli, setConfirmeOubli] = useState(false);
  // Durée du report de l'alerte récap choisie par l'artisan (7 / 14 / 30 jours).
  // La dernière durée retenue est mémorisée et reproposée au prochain report.
  const [joursReport, setJoursReport] = useState<DureeSnoozeRecap>(() => lireDureeSnoozePreferee());
  // Date de retour du report, affichée en direct pendant le choix de la durée.
  const dateRetourReport = useMemo(
    () => formatDateReport(new Date(Date.now() + joursReport * 86_400_000)),
    [joursReport],
  );
  // La cloche rassemble cinq familles d'alertes : rejets de factures électroniques,
  // clients sans nouvelles depuis 14 jours, emails clients en échec, récap mensuel oublié
  // et traitements imminents.
  const total =
    executions.length +
    rejets.length +
    sansNouvelles.length +
    echecs.length +
    (recapOublie ? 1 : 0);

  // Le décompte se rafraîchit tout seul tant qu'un renvoi programmé attend son heure.
  useEffect(() => {
    if (programmes.length === 0) return undefined;
    setMaintenant(Date.now());
    const tic = window.setInterval(() => setMaintenant(Date.now()), 20_000);
    return () => window.clearInterval(tic);
  }, [programmes.length]);

  useEffect(() => {
    const rafraichir = () => setHistoriqueRenvois(lireRenvoisCloche());
    const rafraichirProgrammes = () => setProgrammes(lireRenvoisProgrammes());
    window.addEventListener(RENVOIS_CLOCHE_EVENT, rafraichir);
    window.addEventListener(RENVOIS_PROGRAMMES_EVENT, rafraichirProgrammes);
    return () => {
      window.removeEventListener(RENVOIS_CLOCHE_EVENT, rafraichir);
      window.removeEventListener(RENVOIS_PROGRAMMES_EVENT, rafraichirProgrammes);
    };
  }, []);

  /** Tente un renvoi, affiche le résultat en ligne et l'ajoute à l'historique. */
  const executerRenvoyer = async (echec: EchecEnvoiClient) => {
    setRenvoiEnCours(echec.chantierId);
    setRenvois((prev) => {
      const suite = { ...prev };
      delete suite[echec.chantierId];
      return suite;
    });
    const resultat = await renvoyerEmailClientEnEchec(echec.chantierId, echec.motif);
    const texte = resultat.ok
      ? resultat.destinataire
        ? `Renvoyé à ${resultat.destinataire}.`
        : "Email renvoyé au client."
      : resultat.error ?? "Le renvoi a échoué.";
    setRenvois((prev) => ({ ...prev, [echec.chantierId]: { ok: resultat.ok, texte } }));
    ajouterRenvoiCloche({
      chantierId: echec.chantierId,
      destinataire: resultat.destinataire ?? echec.destinataire,
      ok: resultat.ok,
      message: texte,
    });
    return resultat;
  };

  const renvoyerEmail = async (echec: EchecEnvoiClient) => {
    if (renvoiEnCours !== null || renvoiGroupe) return;
    await executerRenvoyer(echec);
    setRenvoiEnCours(null);
    onReloadEchecs?.();
  };

  /**
   * Envoie une liste d'adresses l'une après l'autre, puis publie le bilan chiffré
   * (X envoyés / Y encore refusés) avec la liste des échecs restants.
   */
  const executerFile = async (liste: EchecEnvoiClient[]) => {
    if (liste.length === 0) return;
    setBilanGroupe(null);
    setRenvoyGroupe({ fait: 0, total: liste.length });
    const refuses: EchecEnvoiClient[] = [];
    let envoyes = 0;
    for (let i = 0; i < liste.length; i += 1) {
      const resultat = await executerRenvoyer(liste[i]);
      if (resultat.ok) envoyes += 1;
      else refuses.push(liste[i]);
      setRenvoyGroupe({ fait: i + 1, total: liste.length });
    }
    setRenvoiEnCours(null);
    setRenvoyGroupe(null);
    setBilanGroupe({ envoyes, refuses });
    onReloadEchecs?.();
  };

  /** Traite d'un coup toutes les adresses refusées, l'une après l'autre. */
  const renvoyerTousEchecs = async () => {
    if (renvoiEnCours !== null || renvoiGroupe) return;
    await executerFile(echecs);
  };

  /** Ne relance que les adresses encore refusées lors du dernier renvoi groupé. */
  const relancerRefuses = async () => {
    if (renvoiEnCours !== null || renvoiGroupe) return;
    if (!bilanGroupe || bilanGroupe.refuses.length === 0) return;
    await executerFile(bilanGroupe.refuses);
  };

  // Renvois différés arrivés à échéance : ils partent automatiquement, une seule fois,
  // et seulement si l'adresse n'a pas été corrigée entre-temps (sinon le renvoi n'a plus
  // de sens : la fiche a été corrigée et le renvoi est proposé depuis le formulaire).
  useEffect(() => {
    if (renvoiEnCours !== null || renvoiGroupe) return;
    const maintenant = Date.now();
    const echecParChantier = new Map(echecs.map((e) => [e.chantierId, e]));
    const du = programmes.find((p) => {
      if (traiteProgramme.current.has(p.chantierId)) return false;
      const prevu = new Date(p.prevuLe).getTime();
      return Number.isFinite(prevu) && prevu <= maintenant;
    });
    if (!du) return;
    const echec = echecParChantier.get(du.chantierId);
    const adresseChangee =
      Boolean(du.destinataire) &&
      Boolean(echec?.destinataire) &&
      du.destinataire !== echec?.destinataire;
    traiteProgramme.current.add(du.chantierId);
    if (!echec || adresseChangee) {
      annulerRenvoiProgramme(du.chantierId);
      return;
    }
    // La programmation est retirée avant l'envoi : elle ne peut donc pas partir deux fois.
    annulerRenvoiProgramme(du.chantierId);
    void (async () => {
      await executerRenvoyer(echec);
      onReloadEchecs?.();
    })();
  }, [programmes, echecs, renvoiEnCours, renvoiGroupe, onReloadEchecs]);

  // Fermeture de l'infobulle au clic extérieur et à la touche Échap.
  useEffect(() => {
    if (!ouvert) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (zoneRef.current && !zoneRef.current.contains(e.target as Node)) setOuvert(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [ouvert]);

  const montantRejets = rejets.reduce((somme, r) => somme + Number(r.totalTtc || 0), 0);
  const apercuJournal = useMemo(() => entrees.slice(0, 3), [entrees]);

  const titreNotif =
    rejets.length > 0
      ? `${rejets.length} facture${rejets.length > 1 ? "s" : ""} électronique${rejets.length > 1 ? "s" : ""} rejetée${rejets.length > 1 ? "s" : ""} à corriger`
      : echecs.length > 0
        ? `${echecs.length} email${echecs.length > 1 ? "s" : ""} client n'a pas pu partir : client non joignable`
        : recapOublie
          ? `Récap de ${recapOublie.moisLabel} non traité : rien n'a été envoyé ni archivé`
          : recapReport
            ? `Alerte récap reportée jusqu'au ${formatDateReport(recapReport.jusquA)} (${recapReport.moisLabel})`
          : sansNouvelles.length > 0
        ? `${sansNouvelles.length} client${sansNouvelles.length > 1 ? "s" : ""} sans nouvelles depuis plus de 14 jours`
        : notif.actif
        ? "Désactiver la notification navigateur des traitements imminents"
        : notif.permission === "denied"
          ? "Notifications bloquées par le navigateur"
          : "Notifier le navigateur quand un traitement devient imminent";

  const exporterRejetsPdf = () => {
    const doc = buildRejetsEfacturePdf({
      moisLabel: "Tous les mois",
      entreprise,
      lignes: rejets.map((r) => ({
        numero: r.numero,
        client: r.clientNom,
        motif: r.motif,
        montantTtc: r.totalTtc,
      })),
    });
    savePdf(doc, `rejets-factures-electroniques-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const rendreLigneJournal = (e: EntreeJournalImminent) => (
    <li key={e.cle} className="flex items-start gap-2 px-2 py-1.5">
      <i className={`${e.icone} text-accent-600 text-sm mt-0.5`}></i>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold text-foreground-900 truncate">{e.nom}</span>
        <span className="block text-[10px] text-foreground-500">
          {formatHorodatage(e.notifieLe)} · signalé à {e.dansMin} min de l'exécution
        </span>
      </span>
    </li>
  );

  return (
    <div className="relative" ref={zoneRef}>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        title={titreNotif}
        aria-label={
          rejets.length > 0
            ? `Alertes de l'espace : ${rejets.length} facture${rejets.length > 1 ? "s" : ""} rejetée${rejets.length > 1 ? "s" : ""} à corriger`
            : echecs.length > 0
              ? `Alertes de l'espace : ${echecs.length} email${echecs.length > 1 ? "s" : ""} client en échec — ouvrir les clients non joignables`
              : recapOublie
                ? `Alertes de l'espace : récap de ${recapOublie.moisLabel} non traité`
                : recapReport
                  ? `Alertes de l'espace : récap de ${recapReport.moisLabel} reporté jusqu'au ${formatDateReport(recapReport.jusquA)}`
                : sansNouvelles.length > 0
              ? `Alertes de l'espace : ${sansNouvelles.length} client${sansNouvelles.length > 1 ? "s" : ""} sans nouvelles depuis plus de 14 jours`
              : "Signalements imminents"
        }
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        className={`relative inline-flex items-center justify-center w-10 h-10 rounded-md border whitespace-nowrap cursor-pointer transition-colors ${
          rejets.length > 0
            ? "bg-accent-100 border-accent-300 text-accent-900 hover:bg-accent-200"
            : recapOublie || recapReport
              ? "bg-secondary-100 border-secondary-300 text-secondary-900 hover:bg-secondary-200"
              : sansNouvelles.length > 0
              ? "bg-primary-100 border-primary-300 text-primary-900 hover:bg-primary-200"
              : notif.actif
                ? "bg-accent-500 border-accent-500 text-background-50 hover:bg-accent-600"
                : "bg-background-100 border-background-200 text-foreground-500 hover:border-primary-300"
        }`}
      >
        <i
          className={
            rejets.length > 0
              ? "ri-error-warning-line text-base"
              : recapOublie
                ? "ri-calendar-close-line text-base"
                : recapReport
                  ? "ri-time-line text-base"
                : sansNouvelles.length > 0
                ? "ri-alarm-warning-line text-base"
                : notif.actif
                  ? "ri-notification-3-fill text-base"
                  : "ri-notification-off-line text-base"
          }
        ></i>
        {total > 0 && (
          <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary-500 text-background-50 text-[10px] font-bold ring-2 ring-background-50 tabular-nums">
            {total > 99 ? "99+" : total}
          </span>
        )}
        {/* Pastille de report : quand le panneau est refermé, on garde sous les yeux le fait
            qu'une alerte récap est repoussée, avec la date de retour. */}
        {!ouvert && recapReport && (
          <span
            title={`Récap de ${recapReport.moisLabel} reporté jusqu'au ${formatDateReport(recapReport.jusquA)}`}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 h-[15px] px-1.5 rounded-full bg-secondary-600 text-background-50 text-[9px] font-bold whitespace-nowrap ring-2 ring-background-50"
          >
            <i className="ri-time-line text-[9px]"></i>
            Récap reporté
          </span>
        )}
      </button>

      {ouvert && (
        <div
          role="dialog"
          aria-label="Réglages des signalements imminents"
          className="absolute right-0 top-full mt-2 z-50 w-80 max-h-[75vh] overflow-y-auto rounded-lg bg-background-50 border border-background-200 p-3"
        >
          <div className="flex items-center gap-2">
            <span className="relative w-7 h-7 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
              <i
                className={
                  rejets.length > 0
                    ? "ri-error-warning-line text-sm"
                    : recapOublie
                      ? "ri-calendar-close-line text-sm"
                      : recapReport
                        ? "ri-time-line text-sm"
                        : sansNouvelles.length > 0
                        ? "ri-alarm-warning-line text-sm"
                        : "ri-timer-flash-line text-sm"
                }
              ></i>
            </span>
            <span className="text-xs font-bold text-foreground-950">
              {rejets.length > 0 || sansNouvelles.length > 0 || recapOublie || recapReport
                ? "Alertes de l'espace"
                : "Signalements imminents"}
            </span>
            <button
              type="button"
              onClick={() => setOuvert(false)}
              aria-label="Fermer"
              className="ml-auto w-7 h-7 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 cursor-pointer transition-colors"
            >
              <i className="ri-close-line text-sm"></i>
            </button>
          </div>

          {/* Factures électroniques rejetées : visibles depuis n'importe quelle page, car un
              rejet bloque le paiement jusqu'à la correction puis la retransmission. */}
          {rejets.length > 0 && (
            <div className="mt-3 rounded-md bg-accent-50 border border-accent-200 p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent-900">
                  <i className="ri-error-warning-line"></i>
                  Factures rejetées · {rejets.length}
                </span>
                <span className="ml-auto text-[10px] font-semibold text-accent-900 tabular-nums">
                  {formatEuros(montantRejets)}
                </span>
              </div>
              <ul className="mt-1.5 flex flex-col gap-1">
                {rejets.slice(0, 4).map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/app/factures?q=${encodeURIComponent(r.numero)}`}
                      onClick={() => setOuvert(false)}
                      title={`Ouvrir ${r.numero} pour corriger ses données`}
                      className="block rounded-md bg-background-50 border border-accent-200 px-2 py-1.5 hover:border-accent-400 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <i className="ri-receipt-line text-accent-700 text-sm shrink-0"></i>
                        <span className="text-[11px] font-semibold text-foreground-900 truncate">{r.numero}</span>
                        <span className="ml-auto text-[10px] font-semibold text-foreground-700 tabular-nums whitespace-nowrap">
                          {formatEuros(r.totalTtc)}
                        </span>
                      </span>
                      <span className="mt-0.5 block pl-5 text-[10px] text-foreground-500 truncate">
                        {r.clientNom ?? "Sans client"}
                      </span>
                      <span className="mt-0.5 block pl-5 text-[10px] text-red-700 break-words">
                        {r.motif?.trim() ? r.motif : "Motif non renseigné"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {rejets.length > 4 && (
                <p className="mt-1 text-[10px] text-accent-900">
                  + {rejets.length - 4} autre{rejets.length - 4 > 1 ? "s" : ""} facture{rejets.length - 4 > 1 ? "s" : ""} à corriger
                </p>
              )}
              <div className="mt-1.5 flex items-center gap-1.5">
                <Link
                  to="/app/facturation-electronique?statut=rejetee"
                  onClick={() => setOuvert(false)}
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-accent-500 text-background-50 text-[10px] font-semibold whitespace-nowrap hover:bg-accent-600 transition-colors"
                >
                  <i className="ri-tools-line"></i>
                  Corriger dans le registre
                </Link>
                <button
                  type="button"
                  onClick={exporterRejetsPdf}
                  title="Télécharger la liste des rejets (numéro, client, motif, montant) pour l'imprimer ou l'envoyer"
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-background-50 border border-accent-200 text-accent-900 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors"
                >
                  <i className="ri-printer-line"></i>
                  PDF
                </button>
              </div>
            </div>
          )}

          {/* Clients sans nouvelles depuis 14 jours : le silence prolongé fait perdre des
              chantiers, on le signale depuis n'importe quelle page, avec accès direct au
              filtre correspondant dans la liste des chantiers. */}
          {sansNouvelles.length > 0 && (
            <div className="mt-3 rounded-md bg-primary-50 border border-primary-200 p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary-900">
                  <i className="ri-alarm-warning-line"></i>
                  Sans nouvelles · {sansNouvelles.length}
                </span>
                <Link
                  to="/app/chantiers?sans-nouvelles=1"
                  onClick={() => setOuvert(false)}
                  title={`${sansNouvelles.length} chantier${sansNouvelles.length > 1 ? "s" : ""} sans nouvelles — ouvrir la liste filtrée`}
                  className="ml-auto inline-flex items-center gap-1 h-5 px-2 rounded-full bg-primary-500 text-background-50 text-[10px] font-bold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-filter-3-line"></i>
                  {sansNouvelles.length} chantier{sansNouvelles.length > 1 ? "s" : ""} sans nouvelles
                </Link>
              </div>
              <ul className="mt-1.5 flex flex-col gap-1">
                {sansNouvelles.slice(0, 4).map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/app/chantiers?sans-nouvelles=1"
                      onClick={() => setOuvert(false)}
                      title={`Ouvrir les chantiers filtrés sur les clients sans nouvelles — ${c.libelle}`}
                      className="block rounded-md bg-background-50 border border-primary-200 px-2 py-1.5 hover:border-primary-400 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <i className="ri-building-2-line text-primary-700 text-sm shrink-0"></i>
                        <span className="text-[11px] font-semibold text-foreground-900 truncate">{c.libelle}</span>
                        <span className="ml-auto text-[10px] font-bold text-primary-800 tabular-nums whitespace-nowrap">
                          {c.jours} j
                        </span>
                      </span>
                      <span className="mt-0.5 block pl-5 text-[10px] text-foreground-500 truncate">
                        {c.jamaisEnvoye ? "Aucun email envoyé au client" : `Dernier email il y a ${c.jours} jours`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {sansNouvelles.length > 4 && (
                <p className="mt-1 text-[10px] text-primary-900">
                  + {sansNouvelles.length - 4} autre{sansNouvelles.length - 4 > 1 ? "s" : ""} chantier
                  {sansNouvelles.length - 4 > 1 ? "s" : ""} dans ce cas
                </p>
              )}
              {/* Rappel discret : sans automatisation, ces clients ne seront relancés que si
                  l'artisan y pense. Le lien mène directement au réglage sur la page Chantiers. */}
              {autoNouvellesActif === false && (
                <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-background-50 border border-dashed border-primary-300 px-2 py-1.5">
                  <i className="ri-robot-2-line text-primary-700 text-sm shrink-0"></i>
                  <span className="min-w-0 flex-1 text-[10px] text-foreground-600 leading-snug">
                    Envoi automatique désactivé : personne ne relancera ces clients sans vous.
                  </span>
                  <Link
                    to="/app/chantiers#envoi-auto"
                    onClick={() => setOuvert(false)}
                    title="Activer l'envoi groupé automatique des nouvelles"
                    className="shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50 border border-primary-300 text-primary-800 text-[10px] font-semibold whitespace-nowrap hover:bg-primary-50 transition-colors"
                  >
                    <i className="ri-toggle-line"></i>
                    Activer
                  </Link>
                </div>
              )}
              <Link
                to="/app/chantiers?sans-nouvelles=1"
                onClick={() => setOuvert(false)}
                className="mt-1.5 inline-flex items-center gap-1 h-7 px-2 rounded-md bg-primary-500 text-background-50 text-[10px] font-semibold whitespace-nowrap hover:bg-primary-600 transition-colors"
              >
                <i className="ri-filter-3-line"></i>
                Voir ces chantiers
              </Link>
            </div>
          )}

          {/* Emails clients refusés par le service d'envoi : le client reste non joignable
              tant que l'adresse n'est pas corrigée. Accès direct à la liste filtrée. */}
          {echecs.length > 0 && (
            <div className="mt-3 rounded-md bg-red-50 border border-red-200 p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-red-800">
                  <i className="ri-mail-close-line"></i>
                  Emails clients en échec · {echecs.length}
                </span>
                <Link
                  to="/app/chantiers?envoi-echec=1"
                  onClick={() => setOuvert(false)}
                  title="Ouvrir la liste des chantiers dont le client n'est pas joignable"
                  className="ml-auto inline-flex items-center gap-1 h-5 px-2 rounded-full bg-red-600 text-white text-[10px] font-bold whitespace-nowrap hover:bg-red-700 transition-colors"
                >
                  <i className="ri-filter-3-line"></i>
                  Non joignables
                </Link>
              </div>
              <button
                type="button"
                onClick={() => void renvoyerTousEchecs()}
                disabled={renvoiGroupe !== null || renvoiEnCours !== null}
                title={`Renvoyer d'un coup les ${echecs.length} adresse${echecs.length > 1 ? "s" : ""} refusée${echecs.length > 1 ? "s" : ""}, sans quitter la page`}
                className="mt-1.5 w-full inline-flex items-center justify-center gap-1.5 h-7 px-2 rounded-md bg-red-600 text-white text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <i className={renvoiGroupe ? "ri-loader-4-line animate-spin" : "ri-send-plane-2-line"}></i>
                {renvoiGroupe
                  ? `Renvoi ${renvoiGroupe.fait}/${renvoiGroupe.total}…`
                  : `Renvoyer les ${echecs.length}`}
              </button>
              <ul className="mt-1.5 flex flex-col gap-1">
                {echecs.slice(0, 3).map((e) => {
                  const enCours = renvoiEnCours === e.chantierId;
                  const resultat = renvois[e.chantierId];
                  const historiqueLignes = historiqueRenvois
                    .filter((h) => h.chantierId === e.chantierId)
                    .slice(0, 2);
                  // Dernier essai refusé : l'adresse est toujours fausse, on met en avant
                  // l'accès direct à la fiche client pour la corriger.
                  const dernierRefus = resultat
                    ? !resultat.ok
                    : historiqueLignes.length > 0
                      ? !historiqueLignes[0].ok
                      : false;
                  // Renvoi différé en attente pour cette adresse, s'il y en a un.
                  const programme = programmes.find((p) => p.chantierId === e.chantierId);
                  return (
                    <li
                      key={e.chantierId}
                      className="rounded-md bg-background-50 border border-red-200 px-2 py-1.5"
                    >
                      <Link
                        to="/app/chantiers?envoi-echec=1"
                        onClick={() => setOuvert(false)}
                        title="Ouvrir les clients non joignables pour corriger l'adresse"
                        className="block hover:text-red-800 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <i className="ri-user-unfollow-line text-red-700 text-sm shrink-0"></i>
                          <span className="text-[11px] font-semibold text-foreground-900 truncate">
                            {e.destinataire?.trim() ? e.destinataire : "Adresse inconnue"}
                          </span>
                          <span className="ml-auto text-[10px] text-foreground-500 whitespace-nowrap">
                            {formatHorodatage(e.created_at)}
                          </span>
                        </span>
                        <span
                          className="mt-0.5 block pl-5 text-[10px] text-red-700 truncate"
                          title={e.erreur ?? undefined}
                        >
                          {e.erreur?.trim() ? e.erreur : "Le service d'envoi a refusé cet email."}
                        </span>
                      </Link>
                      <div className="mt-1 pl-5 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void renvoyerEmail(e)}
                          disabled={renvoiEnCours !== null}
                          title="Renvoyer tout de suite cet email au client, sans quitter la page"
                          className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-red-600 text-white text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <i className={enCours ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}></i>
                          {enCours ? "Envoi…" : "Renvoyer cet email"}
                        </button>
                        {programme ? (
                          <span className="inline-flex items-center gap-1 h-6 pl-1.5 pr-1 rounded-md bg-secondary-50 border border-secondary-300">
                            <i className="ri-timer-line text-secondary-700 text-[11px]"></i>
                            <span className="text-[10px] font-semibold text-secondary-900 whitespace-nowrap">
                              Renvoi prévu {libelleEcheanceRenvoi(programme.prevuLe)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                traiteProgramme.current.add(e.chantierId);
                                annulerRenvoiProgramme(e.chantierId);
                              }}
                              title="Annuler le renvoi différé : l'adresse reste dans la liste, sans envoi automatique"
                              className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded-md bg-background-50 border border-secondary-300 text-secondary-900 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-100 transition-colors"
                            >
                              <i className="ri-close-line"></i>
                              Annuler
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              traiteProgramme.current.delete(e.chantierId);
                              programmerRenvoi({
                                chantierId: e.chantierId,
                                destinataire: e.destinataire,
                                motif: e.motif,
                              });
                            }}
                            disabled={renvoiEnCours !== null || renvoiGroupe !== null}
                            title="Repousser la relance de 24 h : elle partira automatiquement si la fiche n'a pas été corrigée entre-temps"
                            className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50 border border-secondary-300 text-secondary-900 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <i className="ri-timer-line"></i>
                            Renvoyer dans 24 h
                          </button>
                        )}
                        {resultat && (
                          <span
                            className={`min-w-0 text-[10px] font-medium ${
                              resultat.ok ? "text-emerald-700" : "text-red-700"
                            }`}
                            title={resultat.texte}
                          >
                            <i
                              className={`mr-1 ${
                                resultat.ok ? "ri-checkbox-circle-line" : "ri-error-warning-line"
                              }`}
                            ></i>
                            {resultat.texte}
                          </span>
                        )}
                        {e.clientId ? (
                          <Link
                            to={`/app/clients?client=${e.clientId}`}
                            onClick={() => setOuvert(false)}
                            title="Ouvrir la fiche client pour corriger l'adresse email, sans passer par la page Chantiers"
                            className={`inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-semibold whitespace-nowrap transition-colors ${
                              dernierRefus
                                ? "bg-background-50 border border-red-400 text-red-700 hover:bg-red-50"
                                : "bg-background-50 border border-background-300 text-foreground-700 hover:border-primary-300"
                            }`}
                          >
                            <i className="ri-user-settings-line"></i>
                            Corriger l'adresse
                          </Link>
                        ) : (
                          <Link
                            to="/app/clients"
                            onClick={() => setOuvert(false)}
                            title="Ouvrir le carnet de clients pour corriger l'adresse"
                            className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50 border border-background-300 text-foreground-700 text-[10px] font-semibold whitespace-nowrap transition-colors hover:border-primary-300"
                          >
                            <i className="ri-user-settings-line"></i>
                            Ouvrir le carnet
                          </Link>
                        )}
                      </div>
                      {historiqueLignes.length > 0 && (
                        <ul className="mt-1 pl-5 flex flex-col gap-0.5">
                          {historiqueLignes.map((h) => (
                            <li
                              key={h.cle}
                              className="flex items-start gap-1 text-[10px] leading-snug text-foreground-500"
                            >
                              <i
                                className={`mt-[1px] ${
                                  h.ok ? "ri-checkbox-circle-line text-emerald-600" : "ri-error-warning-line text-red-600"
                                }`}
                              ></i>
                              <span className="min-w-0">
                                <span className="font-semibold text-foreground-600">
                                  {formatHorodatage(h.faitLe)}
                                </span>
                                {" · "}
                                <span
                                  className={`font-semibold ${h.ok ? "text-emerald-700" : "text-red-700"}`}
                                >
                                  {h.ok ? "renvoyé" : "refusé"}
                                </span>
                                {h.destinataire ? ` · ${h.destinataire}` : ""}
                                <span className="block truncate text-foreground-400" title={h.message}>
                                  {h.message}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
              {echecs.length > 3 && (
                <p className="mt-1 text-[10px] text-red-900">
                  + {echecs.length - 3} autre{echecs.length - 3 > 1 ? "s" : ""} adresse
                  {echecs.length - 3 > 1 ? "s" : ""} en échec
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Link
                  to="/app/chantiers?envoi-echec=1"
                  onClick={() => setOuvert(false)}
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-red-600 text-white text-[10px] font-semibold whitespace-nowrap hover:bg-red-700 transition-colors"
                >
                  <i className="ri-filter-3-line"></i>
                  Voir les clients non joignables
                </Link>
                {historiqueRenvois.length > 0 &&
                  (confirmeOubli ? (
                    <span className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          viderRenvoisCloche();
                          setRenvois({});
                          setConfirmeOubli(false);
                        }}
                        title="Effacer définitivement l'historique local des renvois de la cloche"
                        className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-red-600 text-white text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-red-700 transition-colors"
                      >
                        <i className="ri-delete-bin-6-line"></i>
                        Confirmer
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmeOubli(false)}
                        className="inline-flex items-center h-7 px-2 rounded-md bg-background-50 border border-background-200 text-foreground-600 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors"
                      >
                        Annuler
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmeOubli(true)}
                      title={`Repartir d'une liste de renvois propre : effacer les ${historiqueRenvois.length} renvoi${historiqueRenvois.length > 1 ? "s" : ""} enregistré${historiqueRenvois.length > 1 ? "s" : ""} dans la cloche`}
                      className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-background-50 border border-red-200 text-red-800 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-red-50 transition-colors"
                    >
                      <i className="ri-history-line"></i>
                      Oublier l'historique
                    </button>
                  ))}
              </div>
              <p className="mt-1 text-[10px] text-foreground-500 leading-snug">
                <i className="ri-timer-line mr-1"></i>
                « Renvoyer dans 24 h » repousse la relance d'une adresse encore refusée : elle part
                automatiquement à l'échéance, sauf si la fiche client a été corrigée entre-temps.
              </p>
            </div>
          )}

          {/* Bilan chiffré du renvoi groupé : il reste affiché même quand toutes les adresses
              sont finalement parties (le bloc rouge, lui, disparaît). */}
          {bilanGroupe && (
            <div className="mt-3 rounded-md bg-background-50 border border-background-300 p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-600">
                  <i className="ri-file-list-3-line"></i>
                  Bilan du renvoi groupé
                </span>
                <button
                  type="button"
                  onClick={() => setBilanGroupe(null)}
                  aria-label="Fermer le bilan"
                  className="ml-auto w-6 h-6 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 cursor-pointer transition-colors"
                >
                  <i className="ri-close-line text-sm"></i>
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <i className="ri-checkbox-circle-line"></i>
                  {bilanGroupe.envoyes} envoyé{bilanGroupe.envoyes > 1 ? "s" : ""}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                    bilanGroupe.refuses.length > 0 ? "text-red-700" : "text-foreground-500"
                  }`}
                >
                  <i className={bilanGroupe.refuses.length > 0 ? "ri-error-warning-line" : "ri-check-double-line"}></i>
                  {bilanGroupe.refuses.length} encore refusé{bilanGroupe.refuses.length > 1 ? "s" : ""}
                </span>
              </div>
              {bilanGroupe.refuses.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => void relancerRefuses()}
                    disabled={renvoiGroupe !== null || renvoiEnCours !== null}
                    title={`Relancer uniquement les ${bilanGroupe.refuses.length} adresse${bilanGroupe.refuses.length > 1 ? "s" : ""} encore refusée${bilanGroupe.refuses.length > 1 ? "s" : ""}`}
                    className="mt-1.5 w-full inline-flex items-center justify-center gap-1.5 h-7 px-2 rounded-md bg-red-600 text-white text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <i className={renvoiGroupe ? "ri-loader-4-line animate-spin" : "ri-restart-line"}></i>
                    {renvoiGroupe
                      ? `Relance ${renvoiGroupe.fait}/${renvoiGroupe.total}…`
                      : `Ne relancer que les ${bilanGroupe.refuses.length} restant${bilanGroupe.refuses.length > 1 ? "s" : ""}`}
                  </button>
                  <p className="mt-1 text-[10px] text-foreground-500 leading-snug">
                    Les adresses déjà parties ne seront pas sollicitées une deuxième fois.
                  </p>
                </>
              ) : (
                <p className="mt-1 text-[10px] text-emerald-700">
                  Toutes les adresses sont parties : plus rien à relancer.
                </p>
              )}
            </div>
          )}

          {/* Renvois prévus : la liste de ce qui doit partir tout seul, avec le temps restant
              avant chaque départ et une annulation groupée. C'est la contrepartie visible du
              « renvoyer dans 24 h » : rien ne part dans le dos de l'artisan. */}
          {programmes.length > 0 && (
            <div className="mt-3 rounded-md bg-secondary-50 border border-secondary-300 p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-900">
                  <i className="ri-timer-flash-line"></i>
                  Renvois prévus · {programmes.length}
                </span>
                {confirmeAnnulationGroupe ? (
                  <span className="ml-auto inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        annulerTousRenvoisProgrammes();
                        setConfirmeAnnulationGroupe(false);
                      }}
                      title={`Annuler les ${programmes.length} renvois prévus : aucun email ne partira automatiquement`}
                      className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-secondary-600 text-background-50 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-700 transition-colors"
                    >
                      <i className="ri-close-circle-line"></i>
                      Confirmer
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmeAnnulationGroupe(false)}
                      className="inline-flex items-center h-6 px-2 rounded-md bg-background-50 border border-secondary-300 text-secondary-900 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-100 transition-colors"
                    >
                      Retour
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmeAnnulationGroupe(true)}
                    title={`Annuler d'un coup les ${programmes.length} renvois prévus`}
                    className="ml-auto inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50 border border-secondary-300 text-secondary-900 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-100 transition-colors"
                  >
                    <i className="ri-close-circle-line"></i>
                    Tout annuler
                  </button>
                )}
              </div>
              <ul className="mt-1.5 flex flex-col gap-1">
                {programmes.map((p) => {
                  const echeance = new Date(p.prevuLe).getTime();
                  const proche = Number.isFinite(echeance) && echeance - maintenant <= 3_600_000;
                  const echecConcerne = echecs.find((e) => e.chantierId === p.chantierId);
                  return (
                    <li
                      key={p.chantierId}
                      className="rounded-md bg-background-50 border border-secondary-200 px-2 py-1.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <i className="ri-send-plane-line text-secondary-700 text-sm shrink-0"></i>
                        <span className="min-w-0 flex-1 text-[11px] font-semibold text-foreground-900 truncate">
                          {p.destinataire?.trim() || echecConcerne?.destinataire?.trim() || "Adresse inconnue"}
                        </span>
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[10px] font-bold whitespace-nowrap tabular-nums ${
                            proche
                              ? "bg-secondary-500 text-background-50"
                              : "bg-secondary-100 text-secondary-900"
                          }`}
                          title={`Départ automatique prévu ${libelleEcheanceRenvoi(p.prevuLe)}`}
                        >
                          <i className={`${proche ? "ri-alarm-warning-line" : "ri-time-line"} text-[10px]`}></i>
                          {libelleDecompteRenvoi(p.prevuLe, maintenant)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-5">
                        <span className="text-[10px] text-foreground-500">
                          Départ {libelleEcheanceRenvoi(p.prevuLe)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            traiteProgramme.current.add(p.chantierId);
                            annulerRenvoiProgramme(p.chantierId);
                          }}
                          title="Annuler ce renvoi précis : l'adresse reste dans la liste des échecs"
                          className="ml-auto inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50 border border-background-300 text-foreground-700 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:border-red-300 hover:text-red-700 transition-colors"
                        >
                          <i className="ri-close-line"></i>
                          Annuler
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1 text-[10px] text-foreground-500 leading-snug">
                <i className="ri-information-line mr-1"></i>
                Chaque renvoi part une seule fois, et s'annule de lui-même si la fiche client a été
                corrigée entre-temps.
              </p>
            </div>
          )}

          {/* Quoi de neuf : la dernière livraison et son annonce détaillée, à portée de clic
              depuis la cloche, juste à côté des renvois prévus. Ouvrir l'annonce vaut lecture.
              Le bloc reste visible même sans aucune alerte : c'est aussi un accès au journal. */}
          <div className="mt-3 rounded-md bg-background-100 border border-background-200 p-2.5">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-500">
                <i className="ri-megaphone-line"></i>
                Quoi de neuf
              </span>
              {nombreNonLues > 0 && (
                <span
                  title={`${nombreNonLues} nouveauté${nombreNonLues > 1 ? "s" : ""} non lue${nombreNonLues > 1 ? "s" : ""} depuis votre dernière visite`}
                  className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold tabular-nums"
                >
                  {nombreNonLues > 9 ? "9+" : nombreNonLues}
                </span>
              )}
              <span className="ml-auto inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-100 text-accent-800 text-[10px] font-bold whitespace-nowrap">
                <i className="ri-git-commit-line"></i>
                v{derniere.version}
              </span>
            </div>
            <p className="mt-1 text-[11px] font-semibold text-foreground-900 leading-snug">
              {derniere.title}
            </p>
            <p className="mt-0.5 text-[10px] text-foreground-500 leading-snug">
              {derniere.dateLabel}
              {nombreNonLues > 1 ? ` · ${nombreNonLues} nouveautés à découvrir` : ""}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Link
                to={derniere.lien ?? "/nouveautes"}
                onClick={() => {
                  marquerToutVu();
                  setOuvert(false);
                }}
                title={`Ouvrir l'annonce détaillée de la version ${derniere.version}`}
                className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-accent-500 text-background-50 text-[10px] font-semibold whitespace-nowrap hover:bg-accent-600 transition-colors"
              >
                <i className="ri-eye-line"></i>
                Voir l'annonce
              </Link>
              <Link
                to="/nouveautes"
                onClick={() => {
                  marquerToutVu();
                  setOuvert(false);
                }}
                title="Parcourir tout le journal des mises à jour"
                className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-background-50 border border-background-300 text-foreground-700 text-[10px] font-semibold whitespace-nowrap hover:border-accent-300 transition-colors"
              >
                <i className="ri-article-line"></i>
                Tout le journal
              </Link>
            </div>
          </div>

          {/* Report en cours : au lieu de simplement masquer le bloc, on affiche jusqu'à
              quand l'alerte est repoussée, avec la possibilité d'annuler tout de suite. */}
          {recapReport && (
            <div className="mt-3 rounded-md bg-background-100 border border-secondary-200 p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-800">
                  <i className="ri-time-line"></i>
                  Alerte récap reportée
                </span>
                <button
                  type="button"
                  onClick={() => annulerSnoozeRecap()}
                  title="Annuler le report : l'alerte revient immédiatement"
                  className="ml-auto inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50 border border-secondary-300 text-secondary-900 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-100 transition-colors"
                >
                  <i className="ri-arrow-go-back-line"></i>
                  Annuler
                </button>
              </div>
              <p className="mt-1 text-[11px] font-semibold text-foreground-900">
                Récap de {recapReport.moisLabel}
              </p>
              <p className="mt-0.5 text-[10px] text-foreground-600 leading-snug">
                Reporté jusqu'au <strong className="font-semibold">{formatDateReport(recapReport.jusquA)}</strong>.
                L'alerte reviendra à cette date si le mois n'est toujours ni envoyé ni archivé.
              </p>
            </div>
          )}

          {/* Récap mensuel oublié : la date programmée est passée et le mois écoulé n'a été
              ni envoyé au comptable ni archivé. Un mois sans trace, c'est une archive
              manquante — on le signale depuis n'importe quelle page. */}
          {recapOublie && (
            <div className="mt-3 rounded-md bg-secondary-50 border border-secondary-300 p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-900">
                  <i className="ri-calendar-close-line"></i>
                  Récap mensuel non traité
                </span>
                <span className="ml-auto inline-flex items-center h-5 px-2 rounded-full bg-secondary-500 text-background-50 text-[10px] font-bold whitespace-nowrap tabular-nums">
                  {recapOublie.joursRetard} j
                </span>
              </div>
              <p className="mt-1 text-[11px] font-semibold text-foreground-900">
                Récap de {recapOublie.moisLabel}
              </p>
              <p className="mt-0.5 text-[10px] text-foreground-600 leading-snug">
                Prévu {recapOublie.echeanceLabel} pour un{" "}
                {recapOublie.mode === "envoi" ? "envoi au comptable" : "archivage dans l'historique"} : rien n'a été
                envoyé ni archivé. Vous pouvez encore l'envoyer ou l'archiver à la main.
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Link
                  to="/app/chantiers#recap-auto"
                  onClick={() => setOuvert(false)}
                  title="Ouvrir le réglage du récap mensuel pour envoyer ou archiver le mois oublié"
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-secondary-600 text-background-50 text-[10px] font-semibold whitespace-nowrap hover:bg-secondary-700 transition-colors"
                >
                  <i className="ri-arrow-right-line"></i>
                  Traiter ce récap
                </Link>
              </div>
              {/* Durée du report au choix : le report restait fixé à 7 jours, ce qui ne collait
                  pas à un envoi manuel prévu plus tard. La date de retour s'affiche en direct. */}
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-secondary-900">
                  <i className="ri-time-line"></i>
                  Reporter :
                </span>
                {([7, 14, 30] as const).map((j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => {
                      setJoursReport(j);
                      memoriserDureeSnooze(j);
                    }}
                    aria-pressed={joursReport === j}
                    title={`Reporter cette alerte de ${j} jours (durée mémorisée pour la prochaine fois)`}
                    className={`inline-flex items-center justify-center h-6 min-w-[30px] px-2 rounded-full border text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      joursReport === j
                        ? "bg-secondary-600 border-secondary-600 text-background-50"
                        : "bg-background-50 border-secondary-300 text-secondary-900 hover:bg-secondary-100"
                    }`}
                  >
                    {j} j
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => snoozerRecapOublie(recapOublie.cle, joursReport)}
                  title={`Masquer cette alerte jusqu'au ${dateRetourReport} : vous enverrez ou archiverez le récap à la main`}
                  className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-secondary-600 text-background-50 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-700 transition-colors"
                >
                  <i className="ri-eye-off-line"></i>
                  Reporter
                </button>
              </div>
              <p className="mt-1 text-[10px] text-foreground-500 leading-snug">
                Alerte masquée jusqu'au <strong className="font-semibold text-foreground-700">{dateRetourReport}</strong>.
                Le report ne concerne que ce mois : l'alerte revient si rien n'est fait d'ici là.
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-secondary-800">
                <i className="ri-bookmark-line"></i>
                {joursReport} jours retenus : cette durée vous sera reproposée au prochain report.
              </p>
            </div>
          )}

          {/* Fenêtre d'alerte : pilote le bandeau, le badge et la notification. */}
          <div className="mt-3">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Fenêtre d'alerte</span>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {FENETRES_IMMINENTES_MIN.map((m) => {
                const actif = prefs.fenetreMin === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => prefs.setFenetreMin(m)}
                    aria-pressed={actif}
                    title={`Signaler les traitements qui partent dans ${libelleFenetre(m)}`}
                    className={`inline-flex items-center h-6 px-2.5 rounded-full border text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      actif
                        ? "bg-accent-500 border-accent-500 text-background-50"
                        : "bg-background-50 border-background-200 text-foreground-600 hover:border-accent-300"
                    }`}
                  >
                    {libelleFenetre(m)}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-foreground-400">
              Un récapitulatif ou une automatisation est signalé s'il part dans cette fenêtre.
            </p>
          </div>

          {/* Bascule de la notification navigateur. */}
          <button
            type="button"
            onClick={notif.toggle}
            aria-pressed={notif.actif}
            title={titreNotif}
            className={`mt-3 w-full inline-flex items-center gap-2 h-9 px-2.5 rounded-md border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              notif.actif
                ? "bg-accent-100 border-accent-200 text-accent-800 hover:bg-accent-200"
                : "bg-background-100 border-background-200 text-foreground-600 hover:border-primary-300"
            }`}
          >
            <i className={notif.actif ? "ri-notification-3-line" : "ri-notification-off-line"}></i>
            {notif.actif
              ? "Notification navigateur activée"
              : notif.permission === "denied"
                ? "Notifications bloquées par le navigateur"
                : "Activer la notification navigateur"}
            {notif.actif && <i className="ri-check-line ml-auto text-accent-700"></i>}
          </button>

          {/* Traitements dans la fenêtre + exclusion unitaire. */}
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                <i className="ri-radar-line"></i>
                Dans la fenêtre · {executions.length}
              </span>
              {executions.length > 0 && (
                <Link
                  to="/app/envois-automatiques"
                  onClick={() => setOuvert(false)}
                  className="text-[10px] font-semibold text-accent-700 hover:underline whitespace-nowrap cursor-pointer"
                >
                  Voir les automatisations
                </Link>
              )}
            </div>
            {executions.length === 0 ? (
              <p className="mt-1.5 rounded-md bg-background-100 px-2.5 py-2 text-[11px] text-foreground-500">
                Aucun traitement ne part dans la fenêtre pour l'instant.
              </p>
            ) : (
              <ul className="mt-1.5 flex flex-col gap-1">
                {executions.map((e) => (
                  <li
                    key={e.item.id}
                    className="flex items-center gap-2 rounded-md bg-background-100 border border-background-200 px-2 py-1.5"
                  >
                    <i className={`${e.item.icone} text-accent-600 text-sm`}></i>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold text-foreground-900 truncate">{e.item.nom}</span>
                      <span className="block text-[10px] text-foreground-500">{libelleDans(e.dansMs)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => prefs.exclure(e.item.id, e.item.nom)}
                      title="Ne plus signaler cette automatisation"
                      aria-label={`Ne plus signaler ${e.item.nom}`}
                      className="shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50 border border-background-200 text-[10px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:border-red-300 hover:text-red-600 transition-colors"
                    >
                      <i className="ri-eye-off-line"></i>
                      Ne plus signaler
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Automatisations exclues du signalement (réactivables). */}
          {prefs.exclusions.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                  <i className="ri-eye-off-line"></i>
                  Exclues · {prefs.exclusions.length}
                </span>
                <button
                  type="button"
                  onClick={prefs.reinclureTout}
                  title="Réactiver le signalement de toutes les automatisations exclues"
                  className="text-[10px] font-semibold text-accent-700 hover:underline whitespace-nowrap cursor-pointer"
                >
                  Tout réactiver
                </button>
              </div>
              <ul className="mt-1.5 flex flex-col gap-1">
                {prefs.exclusions.map((x) => (
                  <li
                    key={x.id}
                    className="flex items-center gap-2 rounded-md bg-background-100 border border-background-200 px-2 py-1.5"
                  >
                    <i className="ri-eye-off-line text-foreground-400 text-sm"></i>
                    <span className="min-w-0 flex-1 text-[11px] font-medium text-foreground-600 truncate">{x.nom}</span>
                    <button
                      type="button"
                      onClick={() => prefs.reinclure(x.id)}
                      title="Réactiver le signalement de cette automatisation"
                      aria-label={`Réactiver le signalement de ${x.nom}`}
                      className="shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-md bg-background-50 border border-background-200 text-[10px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-800 transition-colors"
                    >
                      <i className="ri-eye-line"></i>
                      Réactiver
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Journal local des signalements déjà envoyés. */}
          <div className="mt-3 border-t border-background-200 pt-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                <i className="ri-history-line"></i>
                Journal · {entrees.length}
              </span>
              <span className="inline-flex items-center gap-2">
                {entrees.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setJournalModal(true)}
                    title="Voir tout le journal des signalements"
                    className="text-[10px] font-semibold text-accent-700 hover:underline whitespace-nowrap cursor-pointer"
                  >
                    Voir tout
                  </button>
                )}
                {entrees.length > 0 && (
                  <button
                    type="button"
                    onClick={vider}
                    title="Vider le journal des signalements"
                    className="text-[10px] font-semibold text-foreground-500 hover:text-red-600 whitespace-nowrap cursor-pointer"
                  >
                    Effacer
                  </button>
                )}
              </span>
            </div>
            {entrees.length === 0 ? (
              <p className="mt-1.5 rounded-md bg-background-100 px-2.5 py-2 text-[11px] text-foreground-500">
                Aucun signalement envoyé pour l'instant. Le journal se remplit dès qu'une notification part.
              </p>
            ) : (
              <ul className="mt-1 flex flex-col">{apercuJournal.map(rendreLigneJournal)}</ul>
            )}
          </div>
        </div>
      )}

      {journalModal && (
        <Modal
          title="Journal des signalements imminents"
          subtitle={`${entrees.length} notification${entrees.length > 1 ? "s" : ""} déjà envoyée${entrees.length > 1 ? "s" : ""}.`}
          onClose={() => setJournalModal(false)}
          footer={
            <>
              {entrees.length > 0 && (
                <button
                  type="button"
                  onClick={vider}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-background-50 border border-background-200 text-foreground-600 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors"
                >
                  <i className="ri-delete-bin-6-line"></i>
                  Vider le journal
                </button>
              )}
              <button
                type="button"
                onClick={() => setJournalModal(false)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                Fermer
              </button>
            </>
          }
        >
          {entrees.length === 0 ? (
            <p className="text-xs text-foreground-500">Le journal est vide.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-background-200">
              {entrees.map(rendreLigneJournal)}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}