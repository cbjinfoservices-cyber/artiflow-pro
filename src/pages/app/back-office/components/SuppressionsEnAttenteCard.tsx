import { useCallback, useEffect, useMemo, useState } from "react";
import {
  annulerSuppressionParGestionnaire,
  aAppelerArtisan,
  aRappelerTelephone,
  appeleCetteSemaine,
  compterRelancesManuellesCeMois,
  compterSuivisClosSemaine,
  dateAppel,
  dateMarqueur,
  dejaAppele,
  dernierAppelSansReponse,
  historiqueAppels,
  historiqueRelances,
  joursDepuisDernierAppel,
  libelleResultatAppel,
  marquerArtisanAppele,
  motifRelance,
  noteAppel,
  PLAFOND_RELANCE_GROUPPEE,
  PLAFONDS_RELANCE_GROUPPEE,
  RESULTATS_APPEL,
  SEUIL_SUIVI_APPEL_HEURES,
  fetchSuppressionsEnAttente,
  fetchSeuilSuiviAppel,
  jamaisRappele,
  joursRestantsSuppression,
  nombreRelancesManuelles,
  nombreTentativesAppel,
  rappelJ1Envoye,
  rappelJ7EnRetard,
  rappelJ7Envoye,
  relanceManuelleCeMois,
  relanceManuelleEnvoyee,
  relanceManuelleMultiple,
  relancerArtisanSuppression,
  relancerArtisansSuppression,
  resultatAppel,
  statistiquesAppelsSemaine,
  suiviAppelDu,
  suiviClosApresDernierAppel,
  suiviClosCetteSemaine,
  suiviValideLe,
  suiviValideMotif,
  testerRecapAvecArchive,
  validerSuiviAppel,
  veutPartirArtisan,
  type ResultatAppel,
  type SuppressionEnAttente,
} from "@/lib/suppressionsAdmin";
import { formaterDateFr } from "@/lib/compte";
import { downloadCsv, toCsv } from "@/lib/csv";
import { buildSuppressionsEnAttentePdf, urlBlobPdfBase64 } from "@/lib/suppressionsPdf";
import { savePdf } from "@/lib/pdf";
import ApercuPdfModal from "@/components/feature/ApercuPdfModal";
import HistoriqueRelances from "@/pages/app/back-office/components/HistoriqueRelances";
import HistoriqueAppels from "@/pages/app/back-office/components/HistoriqueAppels";
import ReglageSeuilSuivi from "@/pages/app/back-office/components/ReglageSeuilSuivi";

/** Filtre appliqué à la liste. */
type Filtre =
  | "toutes"
  | "7j"
  | "j1"
  | "jamais"
  | "relances"
  | "relances2"
  | "j7retard"
  | "appeles"
  | "veutpartir"
  | "arappeler"
  | "suividu"
  | "suivisclos";

const LIBELLES_FILTRE: Record<Filtre, string> = {
  toutes: "toutes les demandes",
  "7j": "échéance dans les 7 jours",
  j1: "échéances à J-1 ou le jour même",
  jamais: "artisans jamais rappelés",
  relances: "relancés à la main ce mois-ci",
  relances2: "relancés à la main au moins 2 fois",
  j7retard: "rappel J-7 manquant à 3 jours ou moins",
  appeles: "appelés cette semaine",
  veutpartir: "départs confirmés au téléphone",
  arappeler: "appels restés sans réponse",
  suividu: "suivis automatiques dus",
  suivisclos: "suivis clos cette semaine",
};

const SUFFIXES_FICHIER: Record<Filtre, string> = {
  toutes: "toutes",
  "7j": "7j",
  j1: "j1",
  jamais: "jamais-rappeles",
  relances: "relances-manuelles",
  relances2: "relances-multiples",
  j7retard: "j7-retard",
  appeles: "appeles-semaine",
  veutpartir: "veut-partir",
  arappeler: "a-rappeler",
  suividu: "suivi-du",
  suivisclos: "suivis-clos",
};

/**
 * Encart back-office « Suppressions en attente ».
 *
 * Montre les comptes dont la suppression est programmée mais encore annulable, avec
 * l'entreprise, l'échéance, les jours restants et l'état des rappels J-7 / J-1.
 *
 * Trois actions pour l'équipe :
 *  — **Relancer cet artisan** : envoie tout de suite un email de rappel, sans attendre le cron ;
 *  — **Annuler la suppression** : sauve un compte quand l'artisan se rétracte par téléphone ;
 *  — **Export CSV / PDF** : archive la liste filtrée avec les preuves d'audit.
 *
 * La lecture est protégée côté Backend : seul un gestionnaire peut voir ces demandes.
 */
export default function SuppressionsEnAttenteCard() {
  const [demandes, setDemandes] = useState<SuppressionEnAttente[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<number | null>(null);
  const [relanceEnCours, setRelanceEnCours] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [relancesMois, setRelancesMois] = useState(0);
  const [testArchive, setTestArchive] = useState(false);
  const [archiveInfo, setArchiveInfo] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);
  const [relanceGroupee, setRelanceGroupee] = useState<{ fait: number; total: number } | null>(null);
  const [confirmationGroupee, setConfirmationGroupee] = useState(false);
  // Plafond d'envois choisi avant confirmation (5, 10 ou 20).
  const [plafondEnvois, setPlafondEnvois] = useState<number>(PLAFOND_RELANCE_GROUPPEE);
  // Marquage « appelé » en cours sur une ligne.
  const [appelEnCours, setAppelEnCours] = useState<number | null>(null);
  // Clôture d'un rappel de suivi en cours sur une ligne.
  const [suiviEnCours, setSuiviEnCours] = useState<number | null>(null);
  // Panneau de clôture ouvert (motif facultatif d'audit) sur une ligne.
  const [suiviPour, setSuiviPour] = useState<number | null>(null);
  const [suiviMotif, setSuiviMotif] = useState("");
  // Résultat de l'appel : panneau ouvert sous la ligne concernée.
  const [appelPour, setAppelPour] = useState<number | null>(null);
  const [appelResultat, setAppelResultat] = useState<ResultatAppel>("joint");
  const [appelNote, setAppelNote] = useState("");
  // Motif facultatif : note interne conservée dans la trace d'audit.
  const [motifPour, setMotifPour] = useState<number | null>(null);
  const [motifTexte, setMotifTexte] = useState("");
  const [motifGroupe, setMotifGroupe] = useState("");
  const [apercuArchive, setApercuArchive] = useState<{
    url: string;
    filename: string;
    count: number;
    total: number;
    aAppeler: number;
  } | null>(null);
  // Seuil du rappel de suivi (24 / 48 / 72 h), partagé avec le récap de lundi.
  const [seuilSuivi, setSeuilSuivi] = useState<number>(SEUIL_SUIVI_APPEL_HEURES);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [liste, nbRelances] = await Promise.all([
        fetchSuppressionsEnAttente(),
        compterRelancesManuellesCeMois().catch(() => null),
      ]);
      setDemandes(liste);
      setRelancesMois(
        nbRelances ?? liste.filter((d) => relanceManuelleCeMois(d.details)).length,
      );
    } catch {
      setErreur("Impossible de charger les suppressions en attente pour l'instant. Réessayez dans un instant.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Le seuil de suivi est un réglage partagé : on lit celui enregistré côté Backend.
  useEffect(() => {
    let actif = true;
    fetchSeuilSuiviAppel()
      .then((seuil) => {
        if (actif) setSeuilSuivi(seuil);
      })
      .catch(() => {
        /* repli sur 48 h */
      });
    return () => {
      actif = false;
    };
  }, []);

  const annuler = useCallback(async (id: number) => {
    setEnCours(id);
    setMessage(null);
    try {
      const texte = await annulerSuppressionParGestionnaire(id);
      setDemandes((prev) => prev.filter((d) => d.id !== id));
      setMessage({ type: "ok", texte });
    } catch (e) {
      setMessage({ type: "erreur", texte: e instanceof Error ? e.message : "L'annulation a échoué." });
    } finally {
      setEnCours(null);
      setConfirmation(null);
    }
  }, []);

  const relancer = useCallback(
    async (id: number, motif?: string) => {
      setRelanceEnCours(id);
      setMessage(null);
      // Une relance déjà faite ce mois-ci sur cette demande ne doit pas gonfler le compteur.
      const cible = demandes.find((d) => d.id === id);
      const premiereDuMois = !relanceManuelleCeMois(cible?.details ?? null);
      try {
        const { message: texte, envoyeLe, motif: motifEnregistre } = await relancerArtisanSuppression(
          id,
          motif,
        );
        setDemandes((prev) =>
          prev.map((d) =>
            d.id === id
              ? {
                  ...d,
                  details: {
                    ...(d.details ?? {}),
                    relance_manuelle_le: envoyeLe,
                    relance_motif: motifEnregistre || null,
                    relances_manuelles: nombreRelancesManuelles(d.details) + 1,
                  },
                }
              : d,
          ),
        );
        if (premiereDuMois) setRelancesMois((n) => n + 1);
        setMessage({ type: "ok", texte });
        setMotifPour(null);
        setMotifTexte("");
      } catch (e) {
        setMessage({ type: "erreur", texte: e instanceof Error ? e.message : "La relance a échoué." });
      } finally {
        setRelanceEnCours(null);
      }
    },
    [demandes],
  );

  const imminentes = useMemo(
    () => demandes.filter((d) => joursRestantsSuppression(d.prevue_le) <= 1),
    [demandes],
  );
  const dansSeptJours = useMemo(
    () => demandes.filter((d) => joursRestantsSuppression(d.prevue_le) <= 7),
    [demandes],
  );
  const jamaisRappeles = useMemo(
    () => demandes.filter((d) => jamaisRappele(d.details)),
    [demandes],
  );
  const relancesDuMois = useMemo(
    () => demandes.filter((d) => relanceManuelleCeMois(d.details)),
    [demandes],
  );
  const relancesMultiples = useMemo(
    () => demandes.filter((d) => relanceManuelleMultiple(d.details)),
    [demandes],
  );
  const j7EnRetard = useMemo(
    () => demandes.filter((d) => rappelJ7EnRetard(d.details, d.prevue_le)),
    [demandes],
  );
  const appelesSemaine = useMemo(
    () => demandes.filter((d) => appeleCetteSemaine(d.details)),
    [demandes],
  );
  const veulentPartir = useMemo(
    () => demandes.filter((d) => veutPartirArtisan(d.details)),
    [demandes],
  );
  /** Toutes les lignes dont le dernier appel est resté sans réponse : à retenter. */
  const aRappeler = useMemo(
    () => demandes.filter((d) => aRappelerTelephone(d.details)),
    [demandes],
  );
  /** Suivis automatiques proposés : sans réponse depuis plus longtemps que le seuil réglé. */
  const suivisDus = useMemo(
    () => demandes.filter((d) => suiviAppelDu(d.details, seuilSuivi)),
    [demandes, seuilSuivi],
  );
  /** Récap des appels de la semaine, affiché en tête de l'encart. */
  const statsSemaine = useMemo(() => statistiquesAppelsSemaine(demandes), [demandes]);
  /** Suivis clos depuis lundi : mesure directe de l'effet du seuil réglé. */
  const suivisClosSemaine = useMemo(() => compterSuivisClosSemaine(demandes), [demandes]);
  /** Les lignes réellement closes cette semaine, pour la relecture au clic sur le compteur. */
  const suivisClos = useMemo(
    () => demandes.filter((d) => suiviClosCetteSemaine(d.details)),
    [demandes],
  );
  const liste =
    filtre === "7j"
      ? dansSeptJours
      : filtre === "j1"
        ? imminentes
        : filtre === "jamais"
          ? jamaisRappeles
          : filtre === "relances"
            ? relancesDuMois
            : filtre === "relances2"
              ? relancesMultiples
              : filtre === "j7retard"
                ? j7EnRetard
                : filtre === "appeles"
                  ? appelesSemaine
                  : filtre === "veutpartir"
                    ? veulentPartir
                    : filtre === "arappeler"
                      ? aRappeler
                      : filtre === "suividu"
                        ? suivisDus
                        : filtre === "suivisclos"
                          ? suivisClos
                          : demandes;

  /** Demandes réellement relançables en groupe : email connu et échéance non dépassée. */
  const ciblesRelanceGroupee = useMemo(
    () => j7EnRetard.filter((d) => d.email && joursRestantsSuppression(d.prevue_le) >= 1),
    [j7EnRetard],
  );

  /** Seules les premières demandes partent ce clic-là : plafond anti-envoi massif. */
  const ciblesPlafonnees = useMemo(
    () => ciblesRelanceGroupee.slice(0, plafondEnvois),
    [ciblesRelanceGroupee, plafondEnvois],
  );
  const resteApresPlafond = ciblesRelanceGroupee.length - ciblesPlafonnees.length;

  const relancerEnRetard = useCallback(async () => {
    setConfirmationGroupee(false);
    setMessage(null);
    if (ciblesPlafonnees.length === 0) return;
    setRelanceGroupee({ fait: 0, total: ciblesPlafonnees.length });
    try {
      const resultat = await relancerArtisansSuppression(
        ciblesPlafonnees.map((d) => d.id),
        {
          motif: motifGroupe,
          plafond: plafondEnvois,
        },
      );
      await charger();
      setMotifGroupe("");
      const envoyees = resultat.envoyees.length;
      const echecs = resultat.echecs.length;
      const reste = resultat.ignorees;
      const suffixeReste =
        reste > 0
          ? ` Plafond de ${resultat.plafond} envois par clic : ${reste} artisan${
              reste > 1 ? "s" : ""
            } encore concerné${reste > 1 ? "s" : ""} par un second clic.`
          : "";
      if (envoyees === 0) {
        setMessage({
          type: "erreur",
          texte: `Aucun rappel n'a pu partir. ${resultat.echecs[0]?.message ?? "Réessayez dans un instant."}`,
        });
      } else if (echecs === 0) {
        setMessage({
          type: "ok",
          texte: `${envoyees} rappel${envoyees > 1 ? "s" : ""} envoyé${envoyees > 1 ? "s" : ""} d'un seul clic aux artisans dont le rappel J-7 manquait. Chaque envoi est daté sur sa ligne.${suffixeReste}`,
        });
      } else {
        setMessage({
          type: "erreur",
          texte: `${envoyees} rappel${envoyees > 1 ? "s" : ""} parti${envoyees > 1 ? "s" : ""}, ${echecs} en échec. ${resultat.echecs[0]?.message ?? ""}${suffixeReste}`,
        });
      }
    } catch (e) {
      setMessage({ type: "erreur", texte: e instanceof Error ? e.message : "La relance groupée a échoué." });
    } finally {
      setRelanceGroupee(null);
    }
  }, [ciblesPlafonnees, charger, motifGroupe, plafondEnvois]);

  /** Marque ou démarque un artisan comme appelé, sans quitter la liste. */
  const basculerAppel = useCallback(
    async (id: number, appele: boolean, options?: { resultat?: ResultatAppel; note?: string }) => {
      setAppelEnCours(id);
      setMessage(null);
      try {
        const { message: texte, appeleLe, resultat } = await marquerArtisanAppele(id, appele, options);
        setDemandes((prev) =>
          prev.map((d) => {
            if (d.id !== id) return d;
            const details = { ...(d.details ?? {}) };
            if (appele) {
              const le = appeleLe ?? new Date().toISOString();
              details.appele_le = le;
              details.appel_resultat = resultat ?? options?.resultat ?? "joint";
              details.appel_note = (options?.note ?? "").trim() || null;
              const existant = Array.isArray(details.appels_historique)
                ? (details.appels_historique as unknown[])
                : [];
              details.appels_historique = [
                ...existant,
                {
                  le,
                  resultat: resultat ?? options?.resultat ?? "joint",
                  note: (options?.note ?? "").trim(),
                  par: "",
                },
              ].slice(-8);
            } else {
              delete details.appele_le;
              delete details.appele_par;
              delete details.appel_resultat;
              delete details.appel_note;
            }
            return { ...d, details };
          }),
        );
        setMessage({ type: "ok", texte });
        setAppelPour(null);
        setAppelNote("");
        setAppelResultat("joint");
      } catch (e) {
        setMessage({
          type: "erreur",
          texte: e instanceof Error ? e.message : "Le marquage n'a pas pu être enregistré.",
        });
      } finally {
        setAppelEnCours(null);
      }
    },
    [],
  );

  /**
   * Clôt un rappel de suivi sans nouvel email : la ligne cesse d'être proposée tant
   * qu'aucun nouvel appel n'est consigné, et le compteur de la semaine avance.
   */
  const validerLeSuivi = useCallback(async (id: number, motif?: string) => {
    setSuiviEnCours(id);
    setMessage(null);
    try {
      const { message: texte, valideLe, motif: motifEnregistre } = await validerSuiviAppel(id, motif);
      setDemandes((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                details: {
                  ...(d.details ?? {}),
                  suivi_valide_le: valideLe,
                  suivi_valide_motif: motifEnregistre || null,
                },
              }
            : d,
        ),
      );
      setMessage({ type: "ok", texte });
      setSuiviPour(null);
      setSuiviMotif("");
    } catch (e) {
      setMessage({
        type: "erreur",
        texte: e instanceof Error ? e.message : "Le suivi n'a pas pu être clos.",
      });
    } finally {
      setSuiviEnCours(null);
    }
  }, []);

  const exporterCsv = useCallback(() => {
    const contenu = toCsv(
      [
        "Entreprise",
        "Email",
        "Demande le",
        "Échéance",
        "Jours restants",
        "Rappel J-7",
        "Rappel J-1",
        "Relance manuelle",
        "Nombre de relances manuelles",
        "Motif de la relance",
        "Appelé le",
        "Résultat de l'appel",
        "Tentatives d'appel",
        "Note d'appel",
        "Suivi dû",
        "Abonnement arrêté le",
      ],
      liste.map((d) => [
        d.entreprise || "Non renseignée",
        d.email || "",
        formaterDateFr(d.demandee_le),
        formaterDateFr(d.prevue_le),
        joursRestantsSuppression(d.prevue_le),
        dateMarqueur(d.details, "rappel_j7_envoye_le") || "À venir",
        dateMarqueur(d.details, "rappel_j1_envoye_le") || "À venir",
        dateMarqueur(d.details, "relance_manuelle_le") || "",
        nombreRelancesManuelles(d.details),
        motifRelance(d.details),
        dateAppel(d.details),
        libelleResultatAppel(d.details),
        nombreTentativesAppel(d.details),
        noteAppel(d.details),
        suiviAppelDu(d.details, seuilSuivi)
          ? `Oui · sans réponse depuis ${joursDepuisDernierAppel(d.details)} j (seuil ${seuilSuivi} h)`
          : suiviClosApresDernierAppel(d.details)
            ? `Clos le ${dateMarqueur(d.details, "suivi_valide_le")}${
                suiviValideMotif(d.details) ? ` · motif : ${suiviValideMotif(d.details)}` : ""
              }`
            : "Non",
        d.fin_de_periode_le ? formaterDateFr(d.fin_de_periode_le) : "",
      ]),
    );
    const jour = new Date().toISOString().slice(0, 10);
    downloadCsv(`suppressions-en-attente-${SUFFIXES_FICHIER[filtre]}-${jour}.csv`, contenu);
  }, [liste, filtre, seuilSuivi]);

  const exporterPdf = useCallback(() => {
    const doc = buildSuppressionsEnAttentePdf({
      rows: liste,
      filtreLabel: LIBELLES_FILTRE[filtre],
      seuilSuiviHeures: seuilSuivi,
    });
    const jour = new Date().toISOString().slice(0, 10);
    savePdf(doc, `suppressions-en-attente-${SUFFIXES_FICHIER[filtre]}-${jour}.pdf`);
  }, [liste, filtre, seuilSuivi]);

  const fermerApercuArchive = useCallback(() => {
    setApercuArchive((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  const testerArchiveRecap = useCallback(async () => {
    setTestArchive(true);
    setArchiveInfo(null);
    try {
      const res = await testerRecapAvecArchive();
      // On montre l'archive à l'écran : le téléchargement part de l'aperçu, pas d'ici.
      setApercuArchive({
        url: urlBlobPdfBase64(res.base64),
        filename: res.filename,
        count: res.count,
        total: res.total,
        aAppeler: res.aAppeler,
      });
      setArchiveInfo({
        type: "ok",
        texte: `Archive prête : ${res.filename} — ${res.count} demande${
          res.count > 1 ? "s" : ""
        } annulable${res.count > 1 ? "s" : ""}, ${res.total} alerte${res.total > 1 ? "s" : ""} Stripe dans le récap.${
          res.aAppeler > 0
            ? ` ${res.aAppeler} demande${res.aAppeler > 1 ? "s" : ""} surlignée${
                res.aAppeler > 1 ? "s" : ""
              } (relancée${res.aAppeler > 1 ? "s" : ""} au moins deux fois, pas encore jointe${
                res.aAppeler > 1 ? "s" : ""
              } au téléphone) : à appeler plutôt qu'à relancer par email.`
            : ""
        } Aucun email n'a été envoyé.`,
      });
    } catch (e) {
      setArchiveInfo({
        type: "erreur",
        texte: e instanceof Error ? e.message : "Le test du récap a échoué.",
      });
    } finally {
      setTestArchive(false);
    }
  }, []);

  return (
    <section className="p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
            <i className="ri-time-line"></i>
          </span>
          <div className="min-w-0">
            <h3 className="font-heading font-semibold text-base text-foreground-950">Suppressions en attente</h3>
            <p className="text-xs text-foreground-500 mt-0.5 leading-relaxed">
              Comptes dont la fermeture est programmée mais encore annulable. Les artisans reçoivent un rappel
              automatique à J-7 puis à J-1, et vous pouvez les relancer à la main.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background-50 border border-background-200 text-xs font-semibold text-foreground-700 whitespace-nowrap">
            <i className="ri-list-check-2"></i>
            {demandes.length} en attente
          </span>
          <button
            type="button"
            onClick={() => setFiltre((f) => (f === "relances" ? "toutes" : "relances"))}
            aria-pressed={filtre === "relances"}
            title="Cliquer pour n'afficher que les demandes relancées à la main ce mois-ci (toutes demandes confondues dans le compteur)"
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              filtre === "relances"
                ? "bg-secondary-500 border-secondary-600 text-background-50"
                : "bg-secondary-100 border-secondary-200 text-secondary-900 hover:bg-secondary-200"
            }`}
          >
            <i className={filtre === "relances" ? "ri-filter-fill" : "ri-send-plane-line"}></i>
            {relancesMois} relancé{relancesMois > 1 ? "s" : ""} à la main ce mois-ci
          </button>
          {imminentes.length > 0 && (
            <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap">
              <i className="ri-alarm-warning-line"></i>
              {imminentes.length} imminente{imminentes.length > 1 ? "s" : ""}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              void charger();
            }}
            disabled={chargement}
            title="Rafraîchir la liste"
            className="w-8 h-8 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-foreground-600 cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-50"
          >
            <i className={chargement ? "ri-loader-4-line animate-spin" : "ri-refresh-line"}></i>
          </button>
        </div>
      </div>

      {!erreur && !chargement && demandes.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-background-200 bg-background-50 px-3 py-2">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0">
            <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-800">
              <i className="ri-phone-line text-[13px]"></i>
            </span>
            <span
              title="Tous les appels téléphoniques consignés depuis lundi 00:00"
              className="text-xs font-bold text-foreground-950 whitespace-nowrap"
            >
              {statsSemaine.appels} appel{statsSemaine.appels > 1 ? "s" : ""} cette semaine
            </span>
            <span className="text-foreground-300">·</span>
            <span
              title="Appels où l'artisan a répondu"
              className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-100 border border-accent-200 text-[10px] font-semibold text-accent-900 whitespace-nowrap"
            >
              <i className="ri-checkbox-circle-line"></i>
              {statsSemaine.joints} joint{statsSemaine.joints > 1 ? "s" : ""}
            </span>
            <span className="text-foreground-300">·</span>
            <span
              title="Appels restés sans réponse : ces artisans restent dans la liste à appeler"
              className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-secondary-100 border border-secondary-200 text-[10px] font-semibold text-secondary-900 whitespace-nowrap"
            >
              <i className="ri-volume-mute-line"></i>
              {statsSemaine.sansReponse} sans réponse
            </span>
            {statsSemaine.veutPartir > 0 && (
              <span
                title="Artisans qui ont confirmé au téléphone vouloir partir"
                className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-primary-500 text-background-50 text-[10px] font-bold whitespace-nowrap"
              >
                <i className="ri-logout-box-r-line"></i>
                {statsSemaine.veutPartir} veut partir
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFiltre((f) => (f === "suivisclos" ? "toutes" : "suivisclos"))}
              aria-pressed={filtre === "suivisclos"}
              title="Suivis automatiques clos depuis lundi par un gestionnaire : cliquer pour revoir la liste de ces lignes. Plus le seuil est court, plus ce compteur bouge."
              className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                filtre === "suivisclos"
                  ? "bg-accent-500 border-accent-600 text-background-50"
                  : suivisClosSemaine > 0
                    ? "bg-accent-100 border-accent-300 text-accent-900 hover:bg-accent-200"
                    : "bg-background-100 border-background-200 text-foreground-600 hover:bg-background-200"
              }`}
            >
              <i className={filtre === "suivisclos" ? "ri-filter-fill" : "ri-check-double-line"}></i>
              {suivisClosSemaine} suivi{suivisClosSemaine > 1 ? "s" : ""} clos cette semaine
              {suivisClosSemaine > 0 && (
                <i className={filtre === "suivisclos" ? "ri-arrow-up-line" : "ri-arrow-right-line"}></i>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFiltre((f) => (f === "appeles" ? "toutes" : "appeles"))}
              aria-pressed={filtre === "appeles"}
              title="Revoir les artisans appelés depuis lundi"
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-100 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
            >
              <i className={filtre === "appeles" ? "ri-filter-fill" : "ri-history-line"}></i>
              Appelés cette semaine ({appelesSemaine.length})
            </button>
          </div>
        </div>
      )}

      {!erreur && !chargement && demandes.length > 0 && (
        <ReglageSeuilSuivi
          seuil={seuilSuivi}
          onSeuilChange={setSeuilSuivi}
          onMessage={(m) => {
            if (m) setMessage(m);
          }}
        />
      )}

      {!erreur && !chargement && suivisDus.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent-300 bg-accent-100 px-3 py-2">
          <div className="flex items-start gap-2 min-w-0">
            <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50 mt-0.5">
              <i className="ri-notification-3-line text-[13px]"></i>
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-accent-900">
                {suivisDus.length} rappel{suivisDus.length > 1 ? "s" : ""} de suivi proposé
                {suivisDus.length > 1 ? "s" : ""}
              </p>
              <p className="text-[11px] text-accent-800 mt-0.5">
                Ces artisans n'ont pas répondu à l'appel depuis plus de {seuilSuivi} h. Une nouvelle tentative est
                proposée automatiquement plutôt que d'attendre qu'on y repense. Si le cas est déjà réglé,
                « Valider le suivi » clôt le rappel sans envoyer d'email.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFiltre((f) => (f === "arappeler" ? "toutes" : "arappeler"))}
            aria-pressed={filtre === "arappeler"}
            title="Ouvrir la liste des artisans à rappeler"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
          >
            <i className={filtre === "arappeler" ? "ri-filter-fill" : "ri-phone-find-line"}></i>
            Enchaîner les appels
          </button>
        </div>
      )}

      {message && (
        <p
          className={`mt-3 text-xs rounded-md px-3 py-2 flex items-start gap-2 ${
            message.type === "ok"
              ? "text-accent-800 bg-accent-100 border border-accent-200"
              : "text-red-700 bg-red-50 border border-red-200"
          }`}
        >
          <i className={message.type === "ok" ? "ri-checkbox-circle-line mt-0.5" : "ri-error-warning-line mt-0.5"}></i>
          <span>{message.texte}</span>
        </p>
      )}

      {!erreur && !chargement && demandes.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-full bg-background-50 border border-background-200">
            <button
              type="button"
              onClick={() => setFiltre("toutes")}
              className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                filtre === "toutes"
                  ? "bg-primary-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-100"
              }`}
            >
              <i className="ri-list-check-2"></i>
              Toutes ({demandes.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltre("7j")}
              className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                filtre === "7j"
                  ? "bg-primary-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-100"
              }`}
            >
              <i className="ri-calendar-check-line"></i>
              Échéance dans les 7 jours ({dansSeptJours.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltre("j1")}
              className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                filtre === "j1"
                  ? "bg-accent-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-100"
              }`}
              title="Isoler les échéances du jour et de la veille"
            >
              <i className="ri-alarm-warning-line"></i>
              J-1 uniquement ({imminentes.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltre("jamais")}
              className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                filtre === "jamais"
                  ? "bg-secondary-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-100"
              }`}
              title="Artisans qui n'ont reçu ni rappel J-7, ni J-1, ni relance manuelle"
            >
              <i className="ri-mail-forbid-line"></i>
              Jamais rappelés ({jamaisRappeles.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltre("relances")}
              className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                filtre === "relances"
                  ? "bg-secondary-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-100"
              }`}
              title="Demandes relancées à la main par un gestionnaire depuis le 1er du mois"
            >
              <i className="ri-send-plane-line"></i>
              Relancés ce mois-ci ({relancesDuMois.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltre("relances2")}
              className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                filtre === "relances2"
                  ? "bg-secondary-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-100"
              }`}
              title="Artisans relancés à la main au moins deux fois : ceux qui sont difficiles à joindre"
            >
              <i className="ri-user-voice-line"></i>
              Relancés au moins 2 fois ({relancesMultiples.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltre("j7retard")}
              className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                filtre === "j7retard"
                  ? "bg-accent-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-100"
              }`}
              title="Échéance dans 3 jours ou moins alors que le rappel automatique J-7 n'est jamais parti"
            >
              <i className="ri-timer-flash-line"></i>
              Sans rappel J-7 à moins de 3 j ({j7EnRetard.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltre("appeles")}
              className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                filtre === "appeles"
                  ? "bg-primary-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-100"
              }`}
              title="Artisans déjà joints par téléphone depuis lundi : pratique pour revoir ce qui a été fait cette semaine"
            >
              <i className="ri-phone-line"></i>
              Appelés cette semaine ({appelesSemaine.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltre("veutpartir")}
              className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                filtre === "veutpartir"
                  ? "bg-accent-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-100"
              }`}
              title="Artisans qui ont confirmé au téléphone vouloir partir : à traiter en priorité"
            >
              <i className="ri-logout-box-r-line"></i>
              Veut partir ({veulentPartir.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltre("arappeler")}
              className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                filtre === "arappeler"
                  ? "bg-secondary-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-100"
              }`}
              title="Toutes les lignes dont le dernier appel est resté sans réponse : pour enchaîner les tentatives depuis un seul écran"
            >
              <i className="ri-phone-find-line"></i>
              À rappeler ({aRappeler.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltre("suividu")}
              className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                filtre === "suividu"
                  ? "bg-accent-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-100"
              }`}
              title="Rappels de suivi automatiques dus : appel resté sans réponse depuis plus longtemps que le seuil réglé"
            >
              <i className="ri-notification-3-line"></i>
              Suivi dû ({suivisDus.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltre("suivisclos")}
              className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                filtre === "suivisclos"
                  ? "bg-accent-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-100"
              }`}
              title="Lignes dont le rappel de suivi a été clos depuis lundi : relecture rapide de ce qui a été traité cette semaine"
            >
              <i className="ri-check-double-line"></i>
              Suivis clos ({suivisClos.length})
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-foreground-500 whitespace-nowrap">
              {liste.length} ligne{liste.length > 1 ? "s" : ""} à archiver
            </span>
            <button
              type="button"
              onClick={exporterCsv}
              disabled={liste.length === 0}
              title="Exporter la liste filtrée en CSV"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-file-excel-2-line"></i>
              Export CSV
            </button>
            <button
              type="button"
              onClick={exporterPdf}
              disabled={liste.length === 0}
              title="Générer l'archive PDF à classer avec les preuves d'audit"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-file-pdf-2-line"></i>
              Archive PDF
            </button>
          </div>
        </div>
      )}

      {!erreur && !chargement && ciblesRelanceGroupee.length > 0 && (
        <div className="mt-3 rounded-md border border-accent-300 bg-accent-100 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50 mt-0.5">
                <i className="ri-timer-flash-line text-[13px]"></i>
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-accent-900">
                  {ciblesRelanceGroupee.length} artisan{ciblesRelanceGroupee.length > 1 ? "s" : ""} sans rappel J-7 à 3 jours ou moins
                </p>
                <p className="text-[11px] text-accent-800 mt-0.5">
                  Un seul clic envoie à chacun le même email de rappel que la relance individuelle. Chaque envoi est daté.
                  {resteApresPlafond > 0 && (
                    <>
                      {" "}
                      <strong className="font-semibold">
                        Maximum {plafondEnvois} envois par clic : les {resteApresPlafond} autres resteront dans la
                        liste pour un second clic.
                      </strong>
                    </>
                  )}
                </p>
              </div>
            </div>
            {relanceGroupee ? (
              <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-accent-300 text-xs font-semibold text-accent-900 whitespace-nowrap">
                <i className="ri-loader-4-line animate-spin"></i>
                Envoi de {relanceGroupee.total} rappel{relanceGroupee.total > 1 ? "s" : ""}…
              </span>
            ) : confirmationGroupee ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void relancerEnRetard();
                  }}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
                >
                  <i className="ri-send-plane-line"></i>
                  Envoyer {ciblesPlafonnees.length} rappel{ciblesPlafonnees.length > 1 ? "s" : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmationGroupee(false)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  setConfirmationGroupee(true);
                }}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
              >
                <i className="ri-send-plane-2-line"></i>
                Relancer les {ciblesPlafonnees.length} d'un clic
              </button>
            )}
          </div>
          {confirmationGroupee && !relanceGroupee && (
            <div className="mt-2 border-t border-accent-300 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-accent-900 whitespace-nowrap">
                  Plafond d'envois pour ce clic
                </span>
                <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background-50 border border-accent-300">
                  {PLAFONDS_RELANCE_GROUPPEE.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPlafondEnvois(option)}
                      aria-pressed={plafondEnvois === option}
                      title={
                        option === 5
                          ? "Prudent : 5 emails maximum pour ce clic"
                          : option === 10
                            ? "Équilibré : 10 emails maximum pour ce clic"
                            : "Maximum autorisé : 20 emails pour ce clic"
                      }
                      className={`inline-flex items-center justify-center min-w-[34px] h-6 px-2 rounded-full text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                        plafondEnvois === option
                          ? "bg-accent-500 text-background-50"
                          : "text-accent-900 hover:bg-accent-100"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-accent-800">
                  {ciblesRelanceGroupee.length} artisan{ciblesRelanceGroupee.length > 1 ? "s" : ""} concerné
                  {ciblesRelanceGroupee.length > 1 ? "s" : ""} ·{" "}
                  {ciblesPlafonnees.length} partiront maintenant
                  {resteApresPlafond > 0 ? `, ${resteApresPlafond} au clic suivant` : ""}.
                </span>
              </div>
              <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                <label
                  htmlFor="motif-relance-groupee"
                  className="text-[11px] font-semibold text-accent-900 whitespace-nowrap"
                >
                  Motif de la relance (facultatif)
                </label>
                <input
                  id="motif-relance-groupee"
                  type="text"
                  value={motifGroupe}
                  onChange={(e) => setMotifGroupe(e.target.value)}
                  maxLength={200}
                  placeholder="Ex. : rappel téléphonique du 12/10, artisan injoignable"
                  className="flex-1 min-w-0 h-8 px-2.5 rounded-md bg-background-50 border border-accent-300 text-xs text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-accent-300"
                />
                <span className="text-[10px] text-accent-800 whitespace-nowrap">
                  Note interne, jamais envoyée à l'artisan.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {erreur ? (
        <div className="mt-4 p-4 rounded-md bg-background-50 border border-background-200 text-center">
          <p className="text-xs text-foreground-600">{erreur}</p>
          <button
            type="button"
            onClick={() => {
              void charger();
            }}
            className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Réessayer
          </button>
        </div>
      ) : chargement ? (
        <div className="mt-4 flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-2">
            <i className="ri-loader-4-line animate-spin text-xl text-primary-600"></i>
            <p className="text-xs text-foreground-500">Chargement des demandes…</p>
          </div>
        </div>
      ) : demandes.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 p-4 rounded-md bg-background-50 border border-background-200">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
            <i className="ri-checkbox-circle-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground-900">Aucune suppression programmée</p>
            <p className="text-[11px] text-foreground-500 mt-0.5">
              Aucun compte n'est en période de grâce actuellement. Rien à surveiller.
            </p>
          </div>
        </div>
      ) : liste.length === 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 p-4 rounded-md bg-background-50 border border-background-200">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
            <i
              className={
                filtre === "j1"
                  ? "ri-alarm-warning-line"
                  : filtre === "jamais"
                    ? "ri-mail-forbid-line"
                    : filtre === "relances"
                      ? "ri-send-plane-line"
                      : filtre === "relances2"
                        ? "ri-user-voice-line"
                        : filtre === "j7retard"
                          ? "ri-timer-flash-line"
                          : filtre === "appeles"
                            ? "ri-phone-line"
                            : filtre === "veutpartir"
                              ? "ri-logout-box-r-line"
                              : filtre === "arappeler"
                                ? "ri-phone-find-line"
                                : filtre === "suividu"
                                  ? "ri-check-double-line"
                                  : filtre === "suivisclos"
                                    ? "ri-check-double-line"
                                    : "ri-calendar-check-line"
              }
            ></i>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground-900">
              {filtre === "j1"
                ? "Aucune échéance aujourd'hui ni demain"
                : filtre === "jamais"
                  ? "Tous les artisans ont déjà été prévenus"
                  : filtre === "relances"
                    ? "Aucune relance manuelle ce mois-ci"
                    : filtre === "relances2"
                      ? "Aucun artisan relancé deux fois"
                      : filtre === "j7retard"
                        ? "Aucun rappel J-7 en retard"
                        : filtre === "appeles"
                          ? "Aucun appel consigné cette semaine"
                          : filtre === "veutpartir"
                            ? "Aucun départ confirmé au téléphone"
                            : filtre === "arappeler"
                              ? "Aucun appel en attente de réponse"
                              : filtre === "suividu"
                                ? "Aucun rappel de suivi dû"
                                : filtre === "suivisclos"
                                  ? "Aucun suivi clos cette semaine"
                                  : "Rien dans les 7 prochains jours"}
            </p>
            <p className="text-[11px] text-foreground-500 mt-0.5">
              {filtre === "j1"
                ? "Aucun compte n'arrive à échéance dans les 24 prochaines heures."
                : filtre === "jamais"
                  ? "Chaque demande en attente a déjà reçu au moins un rappel automatique ou manuel."
                  : filtre === "relances"
                    ? "Aucun artisan n'a été relancé à la main depuis le 1er du mois sur les demandes encore en attente."
                    : filtre === "relances2"
                      ? "Personne n'a encore eu besoin de deux relances manuelles : aucun artisan difficile à joindre."
                      : filtre === "j7retard"
                      ? "Toutes les demandes à 3 jours ou moins ont bien reçu leur rappel J-7 automatique."
                      : filtre === "appeles"
                        ? "Personne n'a encore été joint par téléphone depuis lundi : la liste à appeler reste entière."
                        : filtre === "veutpartir"
                          ? "Personne n'a encore annoncé vouloir partir au téléphone : aucun départ à traiter en priorité."
                          : filtre === "arappeler"
                            ? "Tous les appels consignés ont abouti : aucune tentative à reprendre pour l'instant."
                            : filtre === "suividu"
                              ? `Aucun suivi en attente au seuil de ${seuilSuivi} h : les rappels proposés ont été clos ou sont encore dans le délai.`
                              : filtre === "suivisclos"
                                ? "Aucun rappel de suivi n'a été clos depuis lundi : le compteur repart à zéro chaque semaine."
                                : `Aucune échéance n'arrive cette semaine, mais ${demandes.length} demande${
                          demandes.length > 1 ? "s" : ""
                        } reste${demandes.length > 1 ? "nt" : ""} à surveiller plus tard.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFiltre("toutes")}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
          >
            <i className="ri-list-check-2"></i>
            Voir tout
          </button>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {liste.map((d) => {
            const jours = joursRestantsSuppression(d.prevue_le);
            const imminent = jours <= 1;
            const proche = jours <= 7 && !imminent;
            const j7 = rappelJ7Envoye(d.details);
            const j1 = rappelJ1Envoye(d.details);
            const dateJ7 = dateMarqueur(d.details, "rappel_j7_envoye_le");
            const dateJ1 = dateMarqueur(d.details, "rappel_j1_envoye_le");
            const relance = relanceManuelleEnvoyee(d.details);
            const dateRelance = dateMarqueur(d.details, "relance_manuelle_le");
            const motif = motifRelance(d.details);
            const nbRelances = nombreRelancesManuelles(d.details);
            const appele = dejaAppele(d.details);
            const dateAppelLabel = dateAppel(d.details);
            const historique = historiqueRelances(d.details);
            const historiqueAppelsListe = historiqueAppels(d.details);
            const resultatDuJour = resultatAppel(d.details);
            const resultatLabel = libelleResultatAppel(d.details);
            const noteDAppel = noteAppel(d.details);
            const aAppeler = aAppelerArtisan(d.details);
            const sansReponse = dernierAppelSansReponse(d.details);
            const tentatives = nombreTentativesAppel(d.details);
            const suiviDu = suiviAppelDu(d.details, seuilSuivi);
            const joursDepuisAppel = joursDepuisDernierAppel(d.details);
            const suiviValide = suiviValideLe(d.details);
            const suiviClos = suiviValide.length > 0 && suiviClosApresDernierAppel(d.details);
            const dateSuiviClos = dateMarqueur(d.details, "suivi_valide_le");
            const motifSuiviClos = suiviValideMotif(d.details);
            const suiviOuvert = suiviPour === d.id;
            const enConfirmation = confirmation === d.id;
            const motifOuvert = motifPour === d.id;
            const appelOuvert = appelPour === d.id;
            const relanceActive = relanceEnCours === d.id;
            return (
              <li
                key={d.id}
                className={`p-3.5 rounded-md border ${
                  imminent ? "bg-accent-100 border-accent-300" : "bg-background-50 border-background-200"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground-950 truncate">
                        {d.entreprise || "Entreprise non renseignée"}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold whitespace-nowrap ${
                          imminent
                            ? "bg-accent-500 text-background-50"
                            : proche
                              ? "bg-accent-100 text-accent-900 border border-accent-200"
                              : "bg-secondary-100 text-secondary-800"
                        }`}
                      >
                        <i className={imminent ? "ri-alarm-warning-line" : "ri-timer-line"}></i>
                        {jours > 0 ? `J-${jours}` : "Échéance passée"}
                      </span>
                    </div>
                    <p className="text-[11px] text-foreground-500 mt-0.5 truncate">{d.email || "—"}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-foreground-600">
                      <span className="inline-flex items-center gap-1">
                        <i className="ri-calendar-event-line"></i>
                        Échéance : <strong className="font-semibold text-foreground-900">{formaterDateFr(d.prevue_le)}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <i className="ri-history-line"></i>
                        Demande : {formaterDateFr(d.demandee_le)}
                      </span>
                      {d.fin_de_periode_le && (
                        <span className="inline-flex items-center gap-1">
                          <i className="ri-bank-card-line"></i>
                          Abo. arrêté le {formaterDateFr(d.fin_de_periode_le)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span
                        title={
                          j7
                            ? `Le rappel J-7 est parti le ${dateJ7}.`
                            : "Le rappel J-7 partira automatiquement 7 jours avant l'échéance."
                        }
                        className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                          j7 ? "bg-primary-100 text-primary-800" : "bg-background-100 text-foreground-400 border border-background-200"
                        }`}
                      >
                        <i className={j7 ? "ri-mail-check-line" : "ri-mail-line"}></i>
                        {j7 ? `J-7 envoyé le ${dateJ7}` : "Rappel J-7 à venir"}
                      </span>
                      <span
                        title={j1 ? `Le rappel J-1 est parti le ${dateJ1}.` : "Le rappel J-1 partira la veille de l'effacement."}
                        className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                          j1 ? "bg-primary-100 text-primary-800" : "bg-background-100 text-foreground-400 border border-background-200"
                        }`}
                      >
                        <i className={j1 ? "ri-mail-check-line" : "ri-mail-line"}></i>
                        {j1 ? `J-1 envoyé le ${dateJ1}` : "Rappel J-1 à venir"}
                      </span>
                      {relance && (
                        <span
                          title="Un gestionnaire a relancé cet artisan à la main."
                          className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap bg-accent-100 text-accent-900 border border-accent-200"
                        >
                          <i className="ri-send-plane-line"></i>
                          Relancé le {dateRelance}
                        </span>
                      )}
                      {nbRelances >= 2 &&
                        (aAppeler ? (
                          sansReponse ? (
                            <span
                              title="Le dernier appel est resté sans réponse : l'artisan reste dans la liste à appeler. Le compteur reprend toutes les tentatives consignées."
                              className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold whitespace-nowrap bg-secondary-500 text-background-50"
                            >
                              <i className="ri-volume-mute-line"></i>
                              {tentatives} tentative{tentatives > 1 ? "s" : ""} · sans réponse · à rappeler
                            </span>
                          ) : (
                            <span
                              title="Cet artisan a été relancé à la main plusieurs fois : un appel téléphonique sera plus efficace qu'un nouvel email."
                              className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold whitespace-nowrap bg-secondary-500 text-background-50"
                            >
                              <i className="ri-user-voice-line"></i>
                              {nbRelances} relances manuelles · à appeler
                            </span>
                          )
                        ) : (
                          <span
                            title={`Appelé le ${dateAppelLabel}${
                              resultatLabel ? ` · ${resultatLabel}` : ""
                            } : cet artisan ne figure plus dans la liste à appeler.`}
                            className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap bg-primary-100 text-primary-800 border border-primary-200"
                          >
                            <i className="ri-phone-line"></i>
                            Appelé le {dateAppelLabel}
                            {resultatLabel ? ` · ${resultatLabel}` : ""}
                          </span>
                        ))}
                      {suiviDu && (
                        <span
                          title={`Appel resté sans réponse depuis plus de ${seuilSuivi} h (${joursDepuisAppel} j) : un rappel de suivi est proposé.`}
                          className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold whitespace-nowrap bg-accent-100 text-accent-900 border border-accent-300"
                        >
                          <i className="ri-notification-3-line"></i>
                          Suivi dû · sans réponse depuis {joursDepuisAppel} j
                        </span>
                      )}
                      {suiviClos && (
                        <span
                          title={
                            motifSuiviClos
                              ? `Rappel de suivi clos par un gestionnaire le ${dateSuiviClos}. Motif consigné : « ${motifSuiviClos} ». Aucun email n'a été envoyé.`
                              : "Rappel de suivi clos par un gestionnaire : aucun email n'a été envoyé."
                          }
                          className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap bg-background-100 text-foreground-600 border border-background-300 max-w-[260px]"
                        >
                          <i className="ri-check-double-line shrink-0"></i>
                          <span className="truncate">
                            Suivi clos le {dateSuiviClos}
                            {motifSuiviClos ? ` · ${motifSuiviClos}` : ""}
                          </span>
                        </span>
                      )}
                      {resultatDuJour === "veut_partir" && (
                        <span
                          title="L'artisan a confirmé au téléphone qu'il veut partir : la suppression peut suivre son cours."
                          className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold whitespace-nowrap bg-accent-500 text-background-50"
                        >
                          <i className="ri-logout-box-r-line"></i>
                          Veut partir
                        </span>
                      )}
                      {noteDAppel && (
                        <span
                          title={`Note d'appel : ${noteDAppel}`}
                          className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap bg-secondary-100 text-secondary-900 border border-secondary-200 max-w-[220px]"
                        >
                          <i className="ri-phone-line shrink-0"></i>
                          <span className="truncate">
                            {noteDAppel.length > 34 ? `${noteDAppel.slice(0, 32)}…` : noteDAppel}
                          </span>
                        </span>
                      )}
                      {motif && (
                        <span
                          title={`Motif consigné : ${motif}`}
                          className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap bg-secondary-100 text-secondary-900 border border-secondary-200 max-w-[220px]"
                        >
                          <i className="ri-sticky-note-line shrink-0"></i>
                          <span className="truncate">
                            {motif.length > 34 ? `${motif.slice(0, 32)}…` : motif}
                          </span>
                        </span>
                      )}
                    </div>
                    <HistoriqueRelances entrees={historique} />
                    <HistoriqueAppels entrees={historiqueAppelsListe} />
                  </div>

                  <div className="flex flex-col items-stretch gap-2 shrink-0">
                    {enConfirmation ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            void annuler(d.id);
                          }}
                          disabled={enCours === d.id}
                          className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {enCours === d.id ? (
                            <i className="ri-loader-4-line animate-spin"></i>
                          ) : (
                            <i className="ri-check-line"></i>
                          )}
                          Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmation(null)}
                          disabled={enCours === d.id}
                          className="inline-flex items-center justify-center h-9 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-600 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-60"
                        >
                          Non
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setMessage(null);
                            setMotifTexte(motif);
                            setMotifPour(motifOuvert ? null : d.id);
                          }}
                          disabled={relanceActive || relanceEnCours !== null || jours < 1}
                          title={
                            jours < 1
                              ? "L'échéance est passée : la relance n'a plus lieu d'être."
                              : "Envoyer tout de suite un email de rappel à l'artisan"
                          }
                          className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {relanceActive ? (
                            <i className="ri-loader-4-line animate-spin"></i>
                          ) : (
                            <i className="ri-send-plane-line"></i>
                          )}
                          {relanceActive ? "Envoi…" : "Relancer cet artisan"}
                        </button>
                        {suiviDu && (
                          <button
                            type="button"
                            onClick={() => {
                              setMessage(null);
                              setSuiviMotif(motifSuiviClos);
                              setSuiviPour(suiviOuvert ? null : d.id);
                            }}
                            disabled={suiviEnCours === d.id}
                            title="Clore ce rappel de suivi : la ligne sort des suivis dus, sans envoyer de nouvel email"
                            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md bg-accent-100 border border-accent-300 text-accent-900 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <i
                              className={
                                suiviEnCours === d.id ? "ri-loader-4-line animate-spin" : "ri-check-double-line"
                              }
                            ></i>
                            {suiviEnCours === d.id ? "Clôture…" : "Valider le suivi"}
                          </button>
                        )}
                        {(nbRelances >= 2 || appele) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (appele && !sansReponse) {
                                void basculerAppel(d.id, false);
                                return;
                              }
                              setMessage(null);
                              setAppelResultat(resultatDuJour ?? "joint");
                              setAppelNote(noteDAppel);
                              setAppelPour(d.id);
                            }}
                            disabled={appelEnCours === d.id}
                            title={
                              appele && !sansReponse
                                ? "Retirer le marquage : l'artisan revient dans la liste à appeler"
                                : sansReponse
                                  ? "Le dernier appel est resté sans réponse : consigner une nouvelle tentative"
                                  : "Consigner le résultat de l'appel et sortir l'artisan de la liste à appeler"
                            }
                            className={`inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                              appele && !sansReponse
                                ? "bg-primary-100 border-primary-200 text-primary-800 hover:bg-primary-200"
                                : "bg-background-50 border-secondary-300 text-secondary-900 hover:bg-secondary-100"
                            }`}
                          >
                            <i
                              className={
                                appelEnCours === d.id ? "ri-loader-4-line animate-spin" : "ri-phone-line"
                              }
                            ></i>
                            {appele && !sansReponse
                              ? "Appelé — retirer"
                              : sansReponse
                                ? "Nouvel appel"
                                : "Marquer comme appelé"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setMessage(null);
                            setConfirmation(d.id);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md bg-background-50 border border-primary-300 text-primary-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-100 transition-colors"
                        >
                          <i className="ri-arrow-go-back-line"></i>
                          Annuler la suppression
                        </button>
                      </>
                    )}
                    {enConfirmation && (
                      <p className="text-[10px] text-foreground-500 text-center">
                        Le compte sera conservé et prévenu par email.
                      </p>
                    )}
                  </div>
                </div>

                {motifOuvert && (
                  <div className="mt-3 rounded-md border border-secondary-200 bg-secondary-100/70 p-2.5">
                    <label
                      htmlFor={`motif-relance-${d.id}`}
                      className="text-[11px] font-semibold text-secondary-900"
                    >
                      Motif de la relance (facultatif)
                    </label>
                    <input
                      id={`motif-relance-${d.id}`}
                      type="text"
                      value={motifTexte}
                      onChange={(e) => setMotifTexte(e.target.value)}
                      maxLength={200}
                      placeholder="Ex. : appel téléphonique du 12/10, artisan injoignable"
                      className="mt-1 w-full h-9 px-2.5 rounded-md bg-background-50 border border-secondary-200 text-xs text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-secondary-300"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void relancer(d.id, motifTexte);
                        }}
                        disabled={relanceActive || relanceEnCours !== null}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <i className={relanceActive ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}></i>
                        {relanceActive ? "Envoi…" : "Envoyer le rappel"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMotifPour(null);
                          setMotifTexte("");
                        }}
                        disabled={relanceActive}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors disabled:opacity-50"
                      >
                        Annuler
                      </button>
                      <span className="text-[10px] text-foreground-500">
                        Note interne conservée dans la trace d'audit, jamais incluse dans l'email.
                      </span>
                    </div>
                  </div>
                )}

                {appelOuvert && (
                  <div className="mt-3 rounded-md border border-primary-200 bg-primary-100/60 p-2.5">
                    <p className="text-[11px] font-semibold text-primary-900">Résultat de l'appel</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {RESULTATS_APPEL.map((option) => (
                        <button
                          key={option.valeur}
                          type="button"
                          onClick={() => setAppelResultat(option.valeur)}
                          aria-pressed={appelResultat === option.valeur}
                          title={option.libelle}
                          className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors border ${
                            appelResultat === option.valeur
                              ? "bg-primary-500 border-primary-600 text-background-50"
                              : "bg-background-50 border-primary-200 text-primary-900 hover:bg-primary-100"
                          }`}
                        >
                          <i className={option.icone}></i>
                          {option.libelle}
                        </button>
                      ))}
                    </div>
                    <input
                      id={`note-appel-${d.id}`}
                      type="text"
                      value={appelNote}
                      onChange={(e) => setAppelNote(e.target.value)}
                      maxLength={200}
                      placeholder="Note d'appel (facultatif) — ex. : rappelle mardi, hésite encore"
                      className="mt-2 w-full h-9 px-2.5 rounded-md bg-background-50 border border-primary-200 text-xs text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void basculerAppel(d.id, true, { resultat: appelResultat, note: appelNote });
                        }}
                        disabled={appelEnCours === d.id}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <i className={appelEnCours === d.id ? "ri-loader-4-line animate-spin" : "ri-check-line"}></i>
                        {appelEnCours === d.id ? "Enregistrement…" : "Enregistrer l'appel"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAppelPour(null);
                          setAppelNote("");
                          setAppelResultat("joint");
                        }}
                        disabled={appelEnCours === d.id}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors disabled:opacity-50"
                      >
                        Annuler
                      </button>
                      <span className="text-[10px] text-foreground-500">
                        Résultat et note conservés dans la trace d'audit, repris dans les archives PDF.
                      </span>
                    </div>
                  </div>
                )}

                {suiviOuvert && (
                  <div className="mt-3 rounded-md border border-accent-300 bg-accent-100/70 p-2.5">
                    <p className="text-[11px] font-semibold text-accent-900">Clore le rappel de suivi</p>
                    <p className="mt-0.5 text-[11px] text-accent-800 leading-relaxed">
                      Aucun email ne partira. La ligne sort des suivis dus et le motif ci-dessous reste dans la trace
                      d'audit, pour expliquer plus tard pourquoi le rappel a été considéré comme réglé.
                    </p>
                    <label
                      htmlFor={`motif-suivi-${d.id}`}
                      className="mt-2 block text-[11px] font-semibold text-accent-900"
                    >
                      Motif de la clôture (facultatif)
                    </label>
                    <input
                      id={`motif-suivi-${d.id}`}
                      type="text"
                      value={suiviMotif}
                      onChange={(e) => setSuiviMotif(e.target.value)}
                      maxLength={200}
                      placeholder="Ex. : artisan rappelé, renouvelle finalement"
                      className="mt-1 w-full h-9 px-2.5 rounded-md bg-background-50 border border-accent-300 text-xs text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-accent-300"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void validerLeSuivi(d.id, suiviMotif);
                        }}
                        disabled={suiviEnCours === d.id}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <i className={suiviEnCours === d.id ? "ri-loader-4-line animate-spin" : "ri-check-double-line"}></i>
                        {suiviEnCours === d.id ? "Clôture…" : "Confirmer la clôture"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSuiviPour(null);
                          setSuiviMotif("");
                        }}
                        disabled={suiviEnCours === d.id}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors disabled:opacity-50"
                      >
                        Annuler
                      </button>
                      <span className="text-[10px] text-accent-800">
                        Motif interne, jamais transmis à l'artisan.
                      </span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-background-200 pt-3">
        <button
          type="button"
          onClick={() => {
            void testerArchiveRecap();
          }}
          disabled={testArchive}
          title="Construire l'archive PDF exactement comme elle sera jointe au récap hebdo de lundi, l'afficher ici, sans envoyer d'email"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <i className={testArchive ? "ri-loader-4-line animate-spin" : "ri-flask-line"}></i>
          {testArchive ? "Construction de l'archive…" : "Tester le récap avec l'archive"}
        </button>
        <span className="text-[11px] text-foreground-500">
          Vérifie le PDF réellement joint au récap de lundi, en aperçu avant téléchargement. Aucun email n'est envoyé.
        </span>
      </div>

      {archiveInfo && (
        <p
          className={`mt-2 text-xs rounded-md px-3 py-2 flex items-start gap-2 ${
            archiveInfo.type === "ok"
              ? "text-accent-800 bg-accent-100 border border-accent-200"
              : "text-red-700 bg-red-50 border border-red-200"
          }`}
        >
          <i
            className={
              archiveInfo.type === "ok" ? "ri-checkbox-circle-line mt-0.5" : "ri-error-warning-line mt-0.5"
            }
          ></i>
          <span>{archiveInfo.texte}</span>
        </p>
      )}

      <p className="mt-3 text-[11px] text-foreground-400 inline-flex items-start gap-1.5">
        <i className="ri-information-line mt-0.5"></i>
        <span>
          La relance manuelle n'attend pas le cron et laisse une trace datée. L'annulation rétablit aussi le
          renouvellement de l'abonnement, et l'artisan reçoit aussitôt un email confirmant que son compte est conservé.
        </span>
      </p>

      {apercuArchive && (
        <ApercuPdfModal
          title={`Aperçu · ${apercuArchive.filename}`}
          subtitle="Archive telle qu'elle sera jointe au récap hebdo de lundi. Vérifiez-la puis téléchargez-la si elle est bonne."
          filename={apercuArchive.filename}
          pdfUrl={apercuArchive.url}
          note={`${apercuArchive.count} demande${apercuArchive.count > 1 ? "s" : ""} annulable${
            apercuArchive.count > 1 ? "s" : ""
          } et ${apercuArchive.total} alerte${apercuArchive.total > 1 ? "s" : ""} Stripe.${
            apercuArchive.aAppeler > 0
              ? ` ${apercuArchive.aAppeler} ligne${
                  apercuArchive.aAppeler > 1 ? "s" : ""
                } surlignée${apercuArchive.aAppeler > 1 ? "s" : ""} : artisan${
                  apercuArchive.aAppeler > 1 ? "s" : ""
                } à appeler.`
              : ""
          } Aucun email n'a été envoyé.`}
          onClose={fermerApercuArchive}
        />
      )}
    </section>
  );
}