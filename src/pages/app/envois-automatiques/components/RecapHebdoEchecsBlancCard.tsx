import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { JOURS_SEMAINE } from "@/lib/tauxAlerteRecapHebdo";
import {
  chargerJournalRecapsEchecs,
  compterRecapsEchecsMois,
  FENETRES_RECAP_ECHECS,
  normaliserFenetreRecapEchecs,
  normaliserSeuilRecapAlerte,
  SEUILS_RECAP_ALERTE,
  previewRecapEchecsBlanc,
  prochainRecapEchecsBlanc,
  runRecapEchecsBlancNow,
  updateRecapEchecsBlancSettings,
  type JournalRecapsEchecsEntree,
  type RecapEchecsBlancCc,
} from "@/lib/recapEchecsBlanc";
import {
  DELAIS_RELANCE_ANNUEL,
  HEURE_ENVOI_ANNUEL_DEFAUT,
  JOUR_ENVOI_ANNUEL_DEFAUT,
  chargerRelancesAnnuel,
  delaiMoyenRelancesParExercice,
  filtrerDelaisParPeriode,
  normaliserDelaiRelanceAnnuel,
  normaliserHeureEnvoiAnnuel,
  normaliserJourEnvoiAnnuel,
  normaliserPeriodeMoisDelai,
  PERIODES_MOIS_DELAI,
  previewRelanceAnnuel,
  tendanceMoyenneMobile,
  testerRecapEchecsAnnuel,
  testerRelanceAnnuel,
  updateRecapEchecsAnnuelActif,
  updateRecapEchecsAnnuelDate,
  updateRecapEchecsAnnuelDelai,
  updateRecapEchecsAnnuelCcComptable,
  type JournalRelanceAnnuelEntree,
} from "@/lib/recapEchecsAnnuel";
import { lirePeriodeMoisDelai, ecrirePeriodeMoisDelai, lireMoyenneMobileVisible } from "@/lib/delaiPeriodeMemoire";
import { buildDelaiMoyenAnnuelPdf, savePdf } from "@/lib/pdf";
import CcAdressesField from "@/pages/app/envois-automatiques/components/CcAdressesField";
import { formatHorodatage } from "@/lib/diagnosticUi";

type EtatEnreg = "idle" | "enregistrement" | "enregistre" | "erreur";
type EtatAction = "idle" | "chargement" | "succes" | "erreur";

const JOUR_DEFAUT = 1;
const HEURE_DEFAUT = 8;
const FENETRE_DEFAUT = 7;
const SEUIL_DEFAUT = 30;

/** Vrai si la valeur ressemble à une adresse email valide. */
function emailValide(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

/** Libellé court d'une échéance (jour + heure). */
function libelleEcheance(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const jours = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${jours[d.getDay()]} ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à ${heure}`;
}

/**
 * Réglage de l'ENVOI HEBDOMADAIRE du récap d'échecs « test à blanc » : un interrupteur, un jour
 * de la semaine et une heure. La tâche planifiée côté serveur expédie alors, une fois par semaine,
 * un email qui regroupe PAR AUTOMATISATION les échecs des rejeux des 7 derniers jours, avec un
 * fichier CSV en pièce jointe. L'artisan peut prévisualiser l'email ou l'envoyer tout de suite.
 */
export default function RecapHebdoEchecsBlancCard() {
  const { user, profile, refreshProfile } = useAuth();
  const [actif, setActif] = useState(false);
  const [jour, setJour] = useState<number>(JOUR_DEFAUT);
  const [heure, setHeure] = useState<number>(HEURE_DEFAUT);
  const [fenetre, setFenetre] = useState<number>(FENETRE_DEFAUT);
  const [seuil, setSeuil] = useState<number>(SEUIL_DEFAUT);
  // Adresses en copie (Cc) du récap d'échecs LUI-MÊME (comptable, collaborateur…).
  const [ccHebdo, setCcHebdo] = useState<RecapEchecsBlancCc[]>([]);
  // Brouillon local de ces adresses, pour ne pas enregistrer à chaque frappe.
  const [ccHebdoDraft, setCcHebdoDraft] = useState<RecapEchecsBlancCc[]>([{ nom: "", email: "" }]);
  // Adresses en copie (Cc) du rappel « archivage en retard » (comptable, collaborateur…).
  const [cc, setCc] = useState<RecapEchecsBlancCc[]>([]);
  // Brouillon local des adresses en copie, pour ne pas enregistrer à chaque frappe.
  const [ccDraft, setCcDraft] = useState<RecapEchecsBlancCc[]>([{ nom: "", email: "" }]);
  const [etat, setEtat] = useState<EtatEnreg>("idle");
  const [erreur, setErreur] = useState<string | null>(null);

  // Récap annuel de régularité (PDF) : activation + test immédiat.
  const [annuelBusy, setAnnuelBusy] = useState(false);
  const [annuelTestEnCours, setAnnuelTestEnCours] = useState(false);
  const [annuelDateBusy, setAnnuelDateBusy] = useState(false);
  const [annuelMessage, setAnnuelMessage] = useState<{ etat: "succes" | "erreur"; texte: string } | null>(null);
  // Date d'envoi du récap annuel (jour de janvier + heure, heure de Paris).
  const [jourAnnuel, setJourAnnuel] = useState<number>(JOUR_ENVOI_ANNUEL_DEFAUT);
  const [heureAnnuel, setHeureAnnuel] = useState<number>(HEURE_ENVOI_ANNUEL_DEFAUT);
  // Délai (15/30/45 j) de la relance automatique du récap annuel.
  const [delaiAnnuel, setDelaiAnnuel] = useState<number>(15);
  const [delaiAnnuelBusy, setDelaiAnnuelBusy] = useState(false);
  // Test manuel de l'email de relance (« Recevoir la relance maintenant »).
  const [relanceTestEnCours, setRelanceTestEnCours] = useState(false);
  const [relanceMessage, setRelanceMessage] = useState<{ etat: "succes" | "erreur"; texte: string } | null>(null);
  // Option « envoyer aussi le récap annuel au comptable en copie (Cc) ».
  const [ccComptableAnnuel, setCcComptableAnnuel] = useState(false);
  const [ccComptableBusy, setCcComptableBusy] = useState(false);
  // Délai choisi pour le bouton « Rejouer la relance X jours » (test d'une autre échéance).
  const [delaiRejeu, setDelaiRejeu] = useState<number>(15);

  const [apercuOuvert, setApercuOuvert] = useState(false);
  const [apercuHtml, setApercuHtml] = useState<string | null>(null);
  const [apercuEtat, setApercuEtat] = useState<EtatAction>("idle");
  // Aperçu de l'email de RELANCE (aucun envoi), comme pour le récap hebdo : montre le rendu exact
  // du rappel « à confirmer », en simulant éventuellement l'échéance choisie pour le rejeu.
  const [apercuRelanceOuvert, setApercuRelanceOuvert] = useState(false);
  const [apercuRelanceHtml, setApercuRelanceHtml] = useState<string | null>(null);
  const [apercuRelanceEtat, setApercuRelanceEtat] = useState<EtatAction>("idle");
  const [apercuRelanceJours, setApercuRelanceJours] = useState<number | null>(null);
  const [testEtat, setTestEtat] = useState<EtatAction>("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);

  // Journal des récaps envoyés (manuel + automatique) : alimente le compteur du mois.
  const [journal, setJournal] = useState<JournalRecapsEchecsEntree[]>([]);
  // Journal des relances annuelles (auto + manuel) : alimente l'export « évolution du délai moyen ».
  const [relancesAnnuel, setRelancesAnnuel] = useState<JournalRelanceAnnuelEntree[]>([]);
  // État de l'export PDF dédié à la courbe du délai moyen (bouton « Exporter cette courbe »).
  const [exportCourbe, setExportCourbe] = useState<{ etat: "ok" | "erreur"; message: string } | null>(null);
  // Fenêtre de la courbe du délai moyen (12 / 24 / 36 mois) : mémorisée localement et partagée
  // avec le Diagnostic, pour que l'export porte sur la même période que la courbe affichée.
  const [periodeMoisDelai, setPeriodeMoisDelai] = useState<number>(() => lirePeriodeMoisDelai());

  useEffect(() => {
    if (!profile) return;
    setActif(profile.echecs_blanc_recap_hebdo_actif === true);
    const j = Number(profile.echecs_blanc_recap_hebdo_jour);
    setJour(Number.isFinite(j) && j >= 1 && j <= 7 ? j : JOUR_DEFAUT);
    const h = Number(profile.echecs_blanc_recap_hebdo_heure);
    setHeure(Number.isFinite(h) && h >= 0 && h <= 23 ? h : HEURE_DEFAUT);
    setFenetre(normaliserFenetreRecapEchecs(profile.echecs_blanc_recap_hebdo_fenetre));
    setSeuil(normaliserSeuilRecapAlerte(profile.echecs_blanc_recap_alerte_seuil));
    const ccProfil = Array.isArray(profile.echecs_blanc_recap_alerte_cc)
      ? profile.echecs_blanc_recap_alerte_cc
          .map((a) => ({ nom: a.nom ? String(a.nom) : undefined, email: String(a.email ?? "") }))
          .filter((a) => a.email.trim().length > 0)
      : [];
    setCc(ccProfil);
    setCcDraft(ccProfil.length ? ccProfil.map((a) => ({ ...a })) : [{ nom: "", email: "" }]);
    const ccHebdoProfil = Array.isArray(profile.echecs_blanc_recap_hebdo_cc)
      ? profile.echecs_blanc_recap_hebdo_cc
          .map((a) => ({ nom: a.nom ? String(a.nom) : undefined, email: String(a.email ?? "") }))
          .filter((a) => a.email.trim().length > 0)
      : [];
    setCcHebdo(ccHebdoProfil);
    setCcHebdoDraft(ccHebdoProfil.length ? ccHebdoProfil.map((a) => ({ ...a })) : [{ nom: "", email: "" }]);
    setJourAnnuel(normaliserJourEnvoiAnnuel(profile.echecs_blanc_recap_annuel_jour));
    setHeureAnnuel(normaliserHeureEnvoiAnnuel(profile.echecs_blanc_recap_annuel_heure));
    setDelaiAnnuel(normaliserDelaiRelanceAnnuel(profile.echecs_blanc_recap_annuel_relance_delai));
    setCcComptableAnnuel(profile.echecs_blanc_recap_annuel_cc_comptable === true);
  }, [profile]);

  const rechargerJournal = async () => {
    if (!user) {
      setJournal([]);
      return;
    }
    try {
      setJournal(await chargerJournalRecapsEchecs(user.id));
    } catch {
      setJournal([]);
    }
  };

  useEffect(() => {
    void rechargerJournal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Charge le journal des relances annuelles dès que l'utilisateur est connu : il alimente
  // l'export « évolution du délai moyen avant relance » depuis cette page.
  useEffect(() => {
    const uid = user?.id;
    if (!uid) {
      setRelancesAnnuel([]);
      return undefined;
    }
    let actif = true;
    const charger = async () => {
      try {
        const liste = await chargerRelancesAnnuel(uid);
        if (actif) setRelancesAnnuel(liste);
      } catch {
        if (actif) setRelancesAnnuel([]);
      }
    };
    void charger();
    return () => {
      actif = false;
    };
  }, [user]);

  const enregistrer = async (next: {
    actif: boolean;
    jour: number;
    heure: number;
    fenetre: number;
    seuil: number;
    ccHebdo?: RecapEchecsBlancCc[];
    cc?: RecapEchecsBlancCc[];
  }) => {
    if (!user) return;
    setEtat("enregistrement");
    setErreur(null);
    try {
      await updateRecapEchecsBlancSettings(user.id, {
        ...next,
        ccHebdo: next.ccHebdo ?? ccHebdo,
        cc: next.cc ?? cc,
      });
      await refreshProfile();
      setEtat("enregistre");
      window.setTimeout(() => setEtat("idle"), 1800);
    } catch {
      setEtat("erreur");
      setErreur("L'enregistrement du récap hebdomadaire a échoué. Réessayez.");
    }
  };

  const basculerActif = () => {
    const next = !actif;
    setActif(next);
    void enregistrer({ actif: next, jour, heure, fenetre, seuil });
  };

  const changerJour = (value: number) => {
    setJour(value);
    if (actif) void enregistrer({ actif, jour: value, heure, fenetre, seuil });
  };

  const changerHeure = (value: number) => {
    setHeure(value);
    if (actif) void enregistrer({ actif, jour, heure: value, fenetre, seuil });
  };

  const changerFenetre = (value: number) => {
    const propre = normaliserFenetreRecapEchecs(value);
    setFenetre(propre);
    if (actif) void enregistrer({ actif, jour, heure, fenetre: propre, seuil });
  };

  const changerSeuil = (value: number) => {
    const propre = normaliserSeuilRecapAlerte(value);
    setSeuil(propre);
    if (actif) void enregistrer({ actif, jour, heure, fenetre, seuil: propre });
  };

  // Normalise une liste d'adresses en copie : libellé facultatif + adresse email valide uniquement.
  const normaliserCcListe = (liste: RecapEchecsBlancCc[]): RecapEchecsBlancCc[] =>
    liste
      .map((a) => ({ nom: a.nom?.trim() || undefined, email: String(a.email ?? "").trim() }))
      .filter((a) => emailValide(a.email));

  // Enregistre la liste des adresses en copie (Cc) du RÉCAP D'ÉCHECS lui-même.
  const commitCcHebdo = (liste: RecapEchecsBlancCc[]) => {
    const propre = normaliserCcListe(liste);
    setCcHebdo(propre);
    void enregistrer({ actif, jour, heure, fenetre, seuil, ccHebdo: propre });
  };

  // Enregistre la liste des adresses en copie (Cc) du rappel d'archivage, sans tenir compte du fait
  // que le récap soit activé : le réglage est mémorisé pour être appliqué dès le prochain rappel.
  const commitCc = (liste: RecapEchecsBlancCc[]) => {
    const propre = normaliserCcListe(liste);
    setCc(propre);
    void enregistrer({ actif, jour, heure, fenetre, seuil, cc: propre });
  };

  const adressesCcValides = cc.filter((a) => emailValide(a.email));
  const adressesCcHebdoValides = ccHebdo.filter((a) => emailValide(a.email));

  // Bascule l'activation du récap annuel de régularité (PDF).
  const basculerAnnuel = async () => {
    if (!user || annuelBusy) return;
    setAnnuelBusy(true);
    setAnnuelMessage(null);
    try {
      await updateRecapEchecsAnnuelActif(user.id, !annuelActif);
      await refreshProfile();
    } catch {
      setAnnuelMessage({ etat: "erreur", texte: "L'enregistrement du réglage annuel a échoué." });
    } finally {
      setAnnuelBusy(false);
    }
  };

  // Envoie tout de suite un récap annuel de régularité (PDF) à l'artisan, pour vérifier la réception.
  const lancerTestAnnuel = async () => {
    if (!user || annuelTestEnCours) return;
    setAnnuelTestEnCours(true);
    setAnnuelMessage(null);
    try {
      const res = await testerRecapEchecsAnnuel(user.id);
      setAnnuelMessage({
        etat: "succes",
        texte: `Récap annuel envoyé à votre adresse (exercice ${res.annee ?? "en cours"}${
          res.total != null ? ` · ${res.total} récap${res.total > 1 ? "s" : ""} archivé${res.total > 1 ? "s" : ""}` : ""
        }).`,
      });
      await refreshProfile();
    } catch (e) {
      setAnnuelMessage({
        etat: "erreur",
        texte: e instanceof Error ? e.message : "L'envoi du récap annuel a échoué.",
      });
    } finally {
      setAnnuelTestEnCours(false);
    }
  };

  // Enregistre la date d'envoi du récap annuel (jour de janvier + heure, heure de Paris).
  const enregistrerDateAnnuel = async (jour: number, heure: number) => {
    if (!user || annuelDateBusy) return;
    setAnnuelDateBusy(true);
    setAnnuelMessage(null);
    try {
      await updateRecapEchecsAnnuelDate(user.id, jour, heure);
      await refreshProfile();
    } catch {
      setAnnuelMessage({ etat: "erreur", texte: "L'enregistrement de la date d'envoi annuelle a échoué." });
    } finally {
      setAnnuelDateBusy(false);
    }
  };

  const changerJourAnnuel = (value: number) => {
    const propre = normaliserJourEnvoiAnnuel(value);
    setJourAnnuel(propre);
    void enregistrerDateAnnuel(propre, heureAnnuel);
  };

  const changerHeureAnnuel = (value: number) => {
    const propre = normaliserHeureEnvoiAnnuel(value);
    setHeureAnnuel(propre);
    void enregistrerDateAnnuel(jourAnnuel, propre);
  };

  // Enregistre le délai (15/30/45 j) de la relance automatique du récap annuel.
  const changerDelaiAnnuel = async (value: number) => {
    if (!user || delaiAnnuelBusy) return;
    const propre = normaliserDelaiRelanceAnnuel(value);
    setDelaiAnnuel(propre);
    setDelaiAnnuelBusy(true);
    setAnnuelMessage(null);
    try {
      await updateRecapEchecsAnnuelDelai(user.id, propre);
      await refreshProfile();
    } catch {
      setAnnuelMessage({ etat: "erreur", texte: "L'enregistrement du délai de relance a échoué." });
    } finally {
      setDelaiAnnuelBusy(false);
    }
  };

  // Bascule l'option « envoyer aussi le récap annuel au comptable en copie (Cc) ».
  const basculerCcComptableAnnuel = async () => {
    if (!user || ccComptableBusy) return;
    setCcComptableBusy(true);
    setAnnuelMessage(null);
    try {
      await updateRecapEchecsAnnuelCcComptable(user.id, !ccComptableAnnuel);
      await refreshProfile();
    } catch {
      setAnnuelMessage({ etat: "erreur", texte: "L'enregistrement de l'option « au comptable » a échoué." });
    } finally {
      setCcComptableBusy(false);
    }
  };

  // Envoie tout de suite l'email de RELANCE du récap annuel (test de réception « à confirmer »).
  // Un `jours` optionnel permet de REJOUER la relance en simulant une autre échéance (15/30/45 j).
  const lancerTestRelance = async (jours?: number) => {
    if (!user || relanceTestEnCours) return;
    setRelanceTestEnCours(true);
    setRelanceMessage(null);
    try {
      const res = await testerRelanceAnnuel(user.id, jours);
      setRelanceMessage({
        etat: "succes",
        texte: `Relance de test envoyée à votre adresse (exercice ${res.annee ?? "en cours"}${
          res.jours != null ? ` · délai simulé ${res.jours} j` : ""
        }).`,
      });
    } catch (e) {
      setRelanceMessage({
        etat: "erreur",
        texte: e instanceof Error ? e.message : "L'envoi de la relance a échoué.",
      });
    } finally {
      setRelanceTestEnCours(false);
    }
  };

  const ouvrirApercu = async () => {
    if (!user) return;
    setApercuOuvert(true);
    setApercuEtat("chargement");
    setApercuHtml(null);
    try {
      const res = await previewRecapEchecsBlanc(user.id);
      setApercuHtml(res.html);
      setApercuEtat("succes");
    } catch {
      setApercuEtat("erreur");
    }
  };

  // Ouvre l'aperçu de l'email de RELANCE, en simulant éventuellement une autre échéance (15/30/45 j).
  const ouvrirApercuRelance = async (jours?: number) => {
    if (!user) return;
    setApercuRelanceOuvert(true);
    setApercuRelanceEtat("chargement");
    setApercuRelanceHtml(null);
    setApercuRelanceJours(jours ?? null);
    try {
      const res = await previewRelanceAnnuel(user.id, jours);
      setApercuRelanceHtml(res.html);
      setApercuRelanceJours(res.jours ?? null);
      setApercuRelanceEtat("succes");
    } catch {
      setApercuRelanceEtat("erreur");
    }
  };

  const lancerTest = async () => {
    if (!user) return;
    setTestEtat("chargement");
    setTestMessage(null);
    try {
      const res = await runRecapEchecsBlancNow(user.id);
      if (res.sent > 0) {
        setTestEtat("succes");
        setTestMessage("Le récap hebdomadaire vient d'être envoyé à votre adresse.");
        await refreshProfile();
        await rechargerJournal();
      } else {
        setTestEtat("erreur");
        setTestMessage(res.reason || "L'envoi n'a pas abouti (Resend non configuré, adresse manquante ou aucun échec).");
      }
    } catch (e) {
      setTestEtat("erreur");
      setTestMessage(e instanceof Error ? e.message : "L'envoi du récap a échoué.");
    }
  };

  const dernierEnvoi = profile?.echecs_blanc_recap_hebdo_dernier_envoi ?? null;
  // Réglage du récap annuel de régularité (PDF) : activé par défaut.
  const annuelActif = profile?.echecs_blanc_recap_annuel_actif !== false;
  const dernierAnnuel = profile?.echecs_blanc_recap_annuel_dernier ?? null;
  const recapsMois = useMemo(() => compterRecapsEchecsMois(journal), [journal]);
  const prochaine = useMemo(() => prochainRecapEchecsBlanc(jour, heure), [jour, heure]);
  // Série du délai moyen avant relance par exercice : alimente l'export PDF dédié depuis cette page.
  const serieDelaisComplete = useMemo(
    () => delaiMoyenRelancesParExercice(relancesAnnuel, jourAnnuel, heureAnnuel),
    [relancesAnnuel, jourAnnuel, heureAnnuel],
  );
  // Fenêtre affichée (12 / 24 / 36 mois) : l'export porte sur la même période que la courbe.
  const serieDelais = useMemo(
    () => filtrerDelaisParPeriode(serieDelaisComplete, periodeMoisDelai, jourAnnuel, heureAnnuel),
    [serieDelaisComplete, periodeMoisDelai, jourAnnuel, heureAnnuel],
  );
  // Tendance du délai moyen (pente de la moyenne mobile), reportée dans le PDF exporté.
  const tendanceDelai = useMemo(() => tendanceMoyenneMobile(serieDelais, 2), [serieDelais]);

  // Génère et télécharge un PDF dédié à l'évolution du délai moyen par exercice (même document
  // que depuis le Diagnostic, pour une lecture cohérente).
  const exporterCourbeDelais = () => {
    if (serieDelais.length === 0) {
      setExportCourbe({ etat: "erreur", message: "Aucune donnée de délai à exporter pour l'instant." });
      return;
    }
    try {
      const doc = buildDelaiMoyenAnnuelPdf({
        points: serieDelais,
        jour: jourAnnuel,
        heure: heureAnnuel,
        afficherMoyenneMobile: lireMoyenneMobileVisible(),
        tendance: tendanceDelai.sens,
      });
      savePdf(doc, `evolution-delai-moyen-relance-${new Date().toISOString().slice(0, 10)}.pdf`);
      setExportCourbe({ etat: "ok", message: "PDF « évolution du délai moyen » téléchargé." });
    } catch (e) {
      setExportCourbe({
        etat: "erreur",
        message: e instanceof Error ? e.message : "La génération du PDF a échoué.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-4 p-5 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-red-100 text-red-700 text-lg">
            <i className="ri-file-warning-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-semibold text-base text-foreground-950">
              Récap hebdo des échecs test à blanc
            </h3>
            <p className="mt-0.5 text-xs text-foreground-600 max-w-xl leading-relaxed">
              Recevez chaque semaine, à l'adresse de votre choix, un email qui regroupe par automatisation
              les échecs de vos rejeux « test à blanc » des derniers jours (fenêtre réglable), avec un
              fichier CSV en pièce jointe. Un rappel « archivage en retard » vous est aussi adressé si
              aucun récap n'a été archivé au-delà du seuil réglé. Pratique pour archiver la vérification
              des rendus sans ouvrir l'application.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold ${actif ? "text-primary-700" : "text-foreground-400"}`}>
            {actif ? "Activé" : "Coupé"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={actif}
            aria-label="Activer ou couper le récap hebdomadaire des échecs"
            onClick={basculerActif}
            disabled={etat === "enregistrement"}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
              actif ? "bg-primary-500" : "bg-background-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-background-50 shadow transition-transform ${
                actif ? "translate-x-5" : "translate-x-0.5"
              }`}
            ></span>
          </button>
        </div>
      </div>

      {/* Compteur de régularité : récaps d'échecs envoyés ce mois-ci. */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap"
          title="Récaps d'échecs (manuels ou automatiques) envoyés ce mois-ci"
        >
          <i className="ri-mail-send-line text-secondary-600"></i>
          {recapsMois} récap{recapsMois > 1 ? "s" : ""} d'échecs envoyé{recapsMois > 1 ? "s" : ""} ce mois
        </span>
        {dernierEnvoi && (
          <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-background-50 border border-background-200 text-foreground-600 text-[11px] font-semibold whitespace-nowrap">
            <i className="ri-mail-check-line"></i>
            Dernier le {formatHorodatage(dernierEnvoi)}
          </span>
        )}
      </div>

      {actif && (
        <div className="flex flex-col gap-3 animate-fade-in">
          <div className="flex flex-wrap items-center gap-2 text-sm text-foreground-700">
            <span>Envoyer le récap chaque</span>
            <label className="inline-flex items-center gap-1 h-9 px-2.5 rounded-md bg-background-50 border border-background-200 font-semibold">
              <select
                value={jour}
                onChange={(e) => changerJour(Number(e.target.value))}
                disabled={etat === "enregistrement"}
                aria-label="Jour de la semaine d'envoi du récap"
                className="bg-transparent text-foreground-900 font-bold cursor-pointer outline-none"
              >
                {JOURS_SEMAINE.map((j) => (
                  <option key={j.value} value={j.value}>
                    {j.label}
                  </option>
                ))}
              </select>
            </label>
            <span>à</span>
            <label className="inline-flex items-center gap-1 h-9 px-2.5 rounded-md bg-background-50 border border-background-200 font-semibold">
              <select
                value={heure}
                onChange={(e) => changerHeure(Number(e.target.value))}
                disabled={etat === "enregistrement"}
                aria-label="Heure d'envoi du récap"
                className="bg-transparent text-foreground-900 font-bold cursor-pointer outline-none"
              >
                {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")} h
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-foreground-700">
            <span>Fenêtre couverte</span>
            <label className="inline-flex items-center gap-1 h-9 px-2.5 rounded-md bg-background-50 border border-background-200 font-semibold">
              <select
                value={fenetre}
                onChange={(e) => changerFenetre(Number(e.target.value))}
                disabled={etat === "enregistrement"}
                aria-label="Fenêtre (en jours) couverte par le récap d'échecs"
                className="bg-transparent text-foreground-900 font-bold cursor-pointer outline-none"
              >
                {FENETRES_RECAP_ECHECS.map((f) => (
                  <option key={f} value={f}>
                    {f} jours
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs text-foreground-500">de rejeux « test à blanc » récents</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-foreground-700">
            <span>Rappel d'archivage</span>
            <label className="inline-flex items-center gap-1 h-9 px-2.5 rounded-md bg-background-50 border border-background-200 font-semibold">
              <select
                value={seuil}
                onChange={(e) => changerSeuil(Number(e.target.value))}
                disabled={etat === "enregistrement"}
                aria-label="Seuil (en jours) du rappel d'archivage en retard"
                className="bg-transparent text-foreground-900 font-bold cursor-pointer outline-none"
              >
                {SEUILS_RECAP_ALERTE.map((s) => (
                  <option key={s} value={s}>
                    {s} jours
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs text-foreground-500">
              sans récap d'échecs, m'envoyer un rappel
            </span>
          </div>

          {/* Cc du récap d'échecs lui-même — même mécanique que les autres récaps hebdo. */}
          <CcAdressesField
            titre="Cc du récap d'échecs"
            description="Le récap hebdomadaire des échecs est envoyé à votre adresse et en copie (Cc) à ces destinataires (comptable, collaborateur…). Laissez vide pour ne recevoir le récap que vous-même."
            valides={adressesCcHebdoValides.length}
            brouillon={ccHebdoDraft}
            onChange={setCcHebdoDraft}
            onCommit={commitCcHebdo}
          />

          {/* Destinataire en copie (Cc) du rappel d'archivage : comme pour les autres récaps hebdo. */}
          <CcAdressesField
            titre="Cc du rappel d'archivage"
            description="Le rappel « archivage en retard » est envoyé à votre adresse et en copie (Cc) à ces destinataires (comptable, collaborateur…). Laissez vide pour recevoir le rappel uniquement vous-même."
            valides={adressesCcValides.length}
            brouillon={ccDraft}
            onChange={setCcDraft}
            onCommit={commitCc}
          />

          <p className="text-[11px] text-foreground-500 flex items-start gap-1.5 leading-relaxed">
            <i className="ri-information-line mt-px shrink-0"></i>
            <span>
              Prochain envoi prévu : <strong>{libelleEcheance(prochaine)}</strong> (heure de Paris).
              Le récap porte sur les échecs des rejeux des <strong>{fenetre} derniers jours</strong>.
              S'il n'y a aucun échec, aucun email n'est envoyé. Si aucun récap n'a été archivé depuis
              plus de <strong>{seuil} jours</strong>, un rappel « archivage en retard » vous est adressé
              (au plus une fois par semaine).
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => { void ouvrirApercu(); }}
              disabled={apercuEtat === "chargement"}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <i className={apercuEtat === "chargement" ? "ri-loader-4-line animate-spin" : "ri-eye-line"}></i>
              Aperçu de l'email
            </button>
            <button
              type="button"
              onClick={() => { void lancerTest(); }}
              disabled={testEtat === "chargement"}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <i className={testEtat === "chargement" ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}></i>
              {testEtat === "chargement" ? "Envoi…" : "Tester maintenant"}
            </button>
          </div>

          {testEtat === "succes" && testMessage && (
            <p className="text-xs text-accent-700 flex items-center gap-1.5 animate-fade-in">
              <i className="ri-checkbox-circle-line"></i>
              {testMessage}
            </p>
          )}
          {testEtat === "erreur" && testMessage && (
            <p className="text-xs text-red-700 flex items-center gap-1.5">
              <i className="ri-error-warning-line"></i>
              {testMessage}
            </p>
          )}
        </div>
      )}

      {/* Récap annuel de régularité (PDF) — même modèle que les autres bilans annuels. */}
      <div className="flex flex-col gap-2 p-3 rounded-lg bg-background-50 border border-background-200">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700 text-base">
              <i className="ri-file-chart-line"></i>
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground-800 flex flex-wrap items-center gap-2">
                Récap annuel de régularité (PDF)
                {dernierAnnuel && (
                  <span className="inline-flex items-center h-4 px-1.5 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-bold whitespace-nowrap">
                    Dernier exercice : {dernierAnnuel}
                  </span>
                )}
              </p>
              <p className="text-[11px] text-foreground-500 mt-0.5 leading-relaxed">
                Chaque année, à la date réglée ci-dessous, recevez par email un PDF récapitulant la régularité
                de votre archivage des récaps d'échecs sur l'exercice écoulé : mois par mois, répartition
                manuel / automatique, moyenne mensuelle et mois le plus actif.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-semibold ${annuelActif ? "text-primary-700" : "text-foreground-400"}`}>
              {annuelActif ? "Activé" : "Coupé"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={annuelActif}
              aria-label="Activer ou couper le récap annuel de régularité par email"
              onClick={() => { void basculerAnnuel(); }}
              disabled={annuelBusy || !user}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                annuelActif ? "bg-primary-500" : "bg-background-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-background-50 shadow transition-transform ${
                  annuelActif ? "translate-x-5" : "translate-x-0.5"
                }`}
              ></span>
            </button>
          </div>
        </div>
        <div
          className={`flex flex-wrap items-center gap-2 text-xs text-foreground-700 ${annuelActif ? "" : "opacity-50"}`}
        >
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-calendar-event-line text-secondary-600"></i>
            Envoyer le récap annuel le
          </span>
          <label className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-background-100 border border-background-200 font-semibold">
            <select
              value={jourAnnuel}
              onChange={(e) => { changerJourAnnuel(Number(e.target.value)); }}
              disabled={annuelDateBusy || !annuelActif}
              aria-label="Jour de janvier d'envoi du récap annuel"
              className="bg-transparent text-foreground-900 font-bold cursor-pointer outline-none"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <span className="text-foreground-500 font-medium">janvier à</span>
          </label>
          <label className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-background-100 border border-background-200 font-semibold">
            <select
              value={heureAnnuel}
              onChange={(e) => { changerHeureAnnuel(Number(e.target.value)); }}
              disabled={annuelDateBusy || !annuelActif}
              aria-label="Heure d'envoi du récap annuel"
              className="bg-transparent text-foreground-900 font-bold cursor-pointer outline-none"
            >
              {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")} h
                </option>
              ))}
            </select>
          </label>
          <span className="text-[11px] text-foreground-500">(heure de Paris)</span>
        </div>
        {/* Délai de relance automatique : 15, 30 ou 45 jours après la date d'envoi réglée. */}
        <div
          className={`flex flex-wrap items-center gap-2 text-xs text-foreground-700 ${annuelActif ? "" : "opacity-50"}`}
        >
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-alarm-warning-line text-secondary-600"></i>
            Relancer si le récap annuel n'est pas parti après
          </span>
          <label className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-background-100 border border-background-200 font-semibold">
            <select
              value={delaiAnnuel}
              onChange={(e) => { void changerDelaiAnnuel(Number(e.target.value)); }}
              disabled={delaiAnnuelBusy || !annuelActif}
              aria-label="Délai (en jours) de la relance automatique du récap annuel"
              className="bg-transparent text-foreground-900 font-bold cursor-pointer outline-none"
            >
              {DELAIS_RELANCE_ANNUEL.map((d) => (
                <option key={d} value={d}>
                  {d} jours
                </option>
              ))}
            </select>
          </label>
          <span className="text-[11px] text-foreground-500">
            (puis email de relance automatique + badge « à confirmer » synchronisé)
          </span>
        </div>
        {/* Option : envoyer aussi le récap annuel (PDF) au comptable en copie (Cc). */}
        <div
          className={`flex flex-wrap items-center gap-2 text-xs text-foreground-700 ${annuelActif ? "" : "opacity-50"}`}
        >
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-user-star-line text-secondary-600"></i>
            Envoyer aussi le récap annuel au comptable en copie (Cc)
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={ccComptableAnnuel}
            aria-label="Activer ou couper l'envoi du récap annuel au comptable en copie"
            onClick={() => { void basculerCcComptableAnnuel(); }}
            disabled={ccComptableBusy || !annuelActif || !user}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
              ccComptableAnnuel ? "bg-primary-500" : "bg-background-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-background-50 shadow transition-transform ${
                ccComptableAnnuel ? "translate-x-4" : "translate-x-0.5"
              }`}
            ></span>
          </button>
          <span className={`text-[11px] font-semibold ${ccComptableAnnuel ? "text-primary-700" : "text-foreground-400"}`}>
            {ccComptableAnnuel ? "Activé" : "Coupé"}
          </span>
          <span className="text-[11px] text-foreground-500">
            {profile?.comptable_email
              ? `(adresse du comptable : ${profile.comptable_email})`
              : "(ajoutez l'adresse de votre comptable dans votre profil)"}
          </span>
        </div>
        {/* Fenêtre de la courbe du délai moyen (12 / 24 / 36 mois) : aligne l'export PDF sur la période
            affichée. La période est mémorisée localement et partagée avec la courbe du Diagnostic. */}
        <div className={`flex flex-wrap items-center gap-2 text-xs text-foreground-700 ${annuelActif ? "" : "opacity-50"}`}>
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-timer-line text-secondary-600"></i>
            Fenêtre de la courbe du délai moyen
          </span>
          <span
            role="tablist"
            aria-label="Période de la courbe du délai moyen exportée"
            className="inline-flex items-center gap-0.5 p-0.5 rounded-full border border-background-200 bg-background-100"
          >
            {PERIODES_MOIS_DELAI.map((m) => {
              const actif = periodeMoisDelai === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={actif}
                  onClick={() => { const propre = normaliserPeriodeMoisDelai(m); setPeriodeMoisDelai(propre); ecrirePeriodeMoisDelai(propre); }}
                  title={`Exporter les ${m} derniers mois (${m / 12} exercice${m / 12 > 1 ? "s" : ""})`}
                  className={`h-7 px-3 rounded-full text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    actif ? "bg-secondary-500 text-background-50" : "text-foreground-500 hover:bg-background-200"
                  }`}
                >
                  {m} mois
                </button>
              );
            })}
          </span>
          <span className="text-[11px] text-foreground-500">
            ({serieDelais.length} exercice{serieDelais.length > 1 ? "s" : ""} dans l'export)
          </span>
          {/* Pastille de tendance : sens du délai moyen d'après la pente de la moyenne mobile,
              avec la même infobulle « pente = X j/exercice » que sur la courbe du Diagnostic. */}
          {serieDelais.length > 1 && (
            <span
              className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
                tendanceDelai.sens === "allonge"
                  ? "bg-secondary-100 text-secondary-800"
                  : tendanceDelai.sens === "raccourcit"
                    ? "bg-accent-100 text-accent-800"
                    : "bg-background-100 border border-background-200 text-foreground-500"
              }`}
              title={`Tendance du délai moyen : pente = ${tendanceDelai.pente >= 0 ? "+" : ""}${tendanceDelai.pente.toFixed(2).replace(".", ",")} j/exercice (moyenne mobile sur 2 exercices)`}
            >
              <i
                className={
                  tendanceDelai.sens === "allonge"
                    ? "ri-arrow-right-up-line"
                    : tendanceDelai.sens === "raccourcit"
                      ? "ri-arrow-right-down-line"
                      : "ri-arrow-right-line"
                }
              ></i>
              {tendanceDelai.sens === "allonge"
                ? `Relance qui s'allonge (+${tendanceDelai.ecart.toFixed(1)} j)`
                : tendanceDelai.sens === "raccourcit"
                  ? `Relance qui se raccourcit (${tendanceDelai.ecart.toFixed(1)} j)`
                  : "Tendance stable"}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => { void lancerTestAnnuel(); }}
            disabled={annuelTestEnCours || !user}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={annuelTestEnCours ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}></i>
            {annuelTestEnCours ? "Envoi…" : "Tester le récap (PDF)"}
          </button>
          {/* Test manuel de l'email de RELANCE (« à confirmer »), pour vérifier sa réception. */}
          <button
            type="button"
            onClick={() => { void lancerTestRelance(); }}
            disabled={relanceTestEnCours || !user}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={relanceTestEnCours ? "ri-loader-4-line animate-spin" : "ri-mail-send-line"}></i>
            {relanceTestEnCours ? "Envoi…" : "Recevoir la relance maintenant"}
          </button>
          {/* Aperçu de l'email de relance (aucun envoi), comme pour le récap hebdo. */}
          <button
            type="button"
            onClick={() => { void ouvrirApercuRelance(); }}
            disabled={apercuRelanceEtat === "chargement" || !user}
            title="Voir le rendu de l'email de relance avant tout envoi"
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={apercuRelanceEtat === "chargement" ? "ri-loader-4-line animate-spin" : "ri-eye-line"}></i>
            Aperçu de la relance
          </button>
          {/* Export PDF dédié à la courbe de l'évolution du délai moyen avant relance par exercice. */}
          <button
            type="button"
            onClick={exporterCourbeDelais}
            title="Télécharger un PDF dédié à l'évolution du délai moyen avant relance par exercice"
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
          >
            <i className="ri-file-download-line"></i>
            Exporter cette courbe
          </button>
        </div>
        {exportCourbe && (
          <p
            className={`text-xs flex items-center gap-1.5 ${
              exportCourbe.etat === "erreur" ? "text-red-700" : "text-accent-700"
            }`}
          >
            <i
              className={
                exportCourbe.etat === "erreur" ? "ri-error-warning-line" : "ri-checkbox-circle-line"
              }
            ></i>
            {exportCourbe.message}
          </p>
        )}
        {/* Rejouer la relance en simulant une AUTRE échéance de délai (15/30/45 j), pour comparer. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-foreground-700">
            <i className="ri-timer-line text-secondary-600"></i>
            Rejouer la relance
          </span>
          <label className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-background-100 border border-background-200 font-semibold">
            <select
              value={delaiRejeu}
              onChange={(e) => setDelaiRejeu(Number(e.target.value))}
              disabled={relanceTestEnCours || !user}
              aria-label="Échéance de délai à simuler pour la relance de test"
              className="bg-transparent text-foreground-900 font-bold cursor-pointer outline-none text-xs"
            >
              {DELAIS_RELANCE_ANNUEL.map((d) => (
                <option key={d} value={d}>
                  {d} jours
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => { void lancerTestRelance(delaiRejeu); }}
            disabled={relanceTestEnCours || !user}
            title={`Simuler l'envoi de la relance comme si la date réglée était dépassée de ${delaiRejeu} jours`}
            className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-accent-100 text-accent-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={relanceTestEnCours ? "ri-loader-4-line animate-spin" : "ri-restart-line"}></i>
            Rejouer la relance {delaiRejeu} jours
          </button>
        </div>
        {annuelMessage && (
          <p className={`text-xs flex items-center gap-1.5 ${annuelMessage.etat === "erreur" ? "text-red-700" : "text-accent-700"}`}>
            <i className={annuelMessage.etat === "erreur" ? "ri-error-warning-line" : "ri-checkbox-circle-line"}></i>
            {annuelMessage.texte}
          </p>
        )}
        {relanceMessage && (
          <p className={`text-xs flex items-center gap-1.5 ${relanceMessage.etat === "erreur" ? "text-red-700" : "text-accent-700"}`}>
            <i className={relanceMessage.etat === "erreur" ? "ri-error-warning-line" : "ri-checkbox-circle-line"}></i>
            {relanceMessage.texte}
          </p>
        )}
        {/* Aperçu de l'email de relance : rendu exact de l'email « à confirmer » avant envoi. */}
        {apercuRelanceOuvert && (
          <div className="flex flex-col gap-2 p-3 rounded-md bg-background-100 border border-background-200 animate-fade-in">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                <i className="ri-mail-line"></i>
                Aperçu de l'email de relance
                {apercuRelanceJours != null && ` · délai simulé ${apercuRelanceJours} j`}
              </span>
              <button
                type="button"
                onClick={() => setApercuRelanceOuvert(false)}
                aria-label="Fermer l'aperçu de la relance"
                className="w-6 h-6 flex items-center justify-center rounded-md text-foreground-400 hover:text-foreground-700 hover:bg-background-200 cursor-pointer transition-colors"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
            {apercuRelanceEtat === "chargement" && (
              <p className="text-xs text-foreground-500 flex items-center gap-1.5 py-3">
                <i className="ri-loader-4-line animate-spin"></i>
                Construction de l'aperçu…
              </p>
            )}
            {apercuRelanceEtat === "erreur" && (
              <p className="text-xs text-red-700 flex items-center gap-1.5 py-3">
                <i className="ri-error-warning-line"></i>
                L'aperçu de la relance n'a pas pu être généré.
              </p>
            )}
            {apercuRelanceEtat === "succes" && apercuRelanceHtml && (
              <>
                <iframe
                  title="Aperçu de l'email de relance du récap annuel d'échecs"
                  srcDoc={apercuRelanceHtml}
                  sandbox=""
                  className="w-full h-96 rounded-md border border-background-200 bg-background-50"
                />
                {/* Enchaîne directement sur l'envoi RÉEL du rappel, avec l'échéance simulée à l'aperçu. */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { void lancerTestRelance(apercuRelanceJours ?? undefined); }}
                    disabled={relanceTestEnCours || !user}
                    title="Envoyer réellement cet email de relance (à votre adresse + copies Cc configurées)"
                    className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-accent-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <i className={relanceTestEnCours ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}></i>
                    {relanceTestEnCours ? "Envoi…" : "Envoyer ce rappel maintenant"}
                  </button>
                  <span className="text-[11px] text-foreground-500">
                    Envoie réellement l'email (votre adresse + copies Cc).
                  </span>
                </div>
              </>
            )}
          </div>
        )}
        {!annuelActif && (
          <p className="text-[11px] text-foreground-500 flex items-center gap-1.5">
            <i className="ri-notification-off-line"></i>
            Récap annuel coupé : aucun PDF de fin d'année ne sera envoyé.
          </p>
        )}
      </div>

      {apercuOuvert && (
        <div className="flex flex-col gap-2 p-3 rounded-md bg-background-50 border border-background-200 animate-fade-in">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              <i className="ri-mail-line"></i>
              Aperçu de l'email
            </span>
            <button
              type="button"
              onClick={() => setApercuOuvert(false)}
              aria-label="Fermer l'aperçu"
              className="w-6 h-6 flex items-center justify-center rounded-md text-foreground-400 hover:text-foreground-700 hover:bg-background-200 cursor-pointer transition-colors"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
          {apercuEtat === "chargement" && (
            <p className="text-xs text-foreground-500 flex items-center gap-1.5 py-3">
              <i className="ri-loader-4-line animate-spin"></i>
              Construction de l'aperçu…
            </p>
          )}
          {apercuEtat === "erreur" && (
            <p className="text-xs text-red-700 flex items-center gap-1.5 py-3">
              <i className="ri-error-warning-line"></i>
              L'aperçu n'a pas pu être généré.
            </p>
          )}
          {apercuEtat === "succes" && apercuHtml && (
            <iframe
              title="Aperçu du récap hebdomadaire des échecs test à blanc"
              srcDoc={apercuHtml}
              sandbox=""
              className="w-full h-96 rounded-md border border-background-200 bg-background-50"
            />
          )}
        </div>
      )}

      {etat === "enregistre" && (
        <p className="text-xs text-accent-700 flex items-center gap-1.5 animate-fade-in">
          <i className="ri-checkbox-circle-line"></i>
          Réglage enregistré. La tâche planifiée suivra ce choix.
        </p>
      )}
      {etat === "erreur" && erreur && (
        <p className="text-xs text-red-700 flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {erreur}
        </p>
      )}
      {!actif && (
        <p className="text-xs text-foreground-500 flex items-center gap-1.5">
          <i className="ri-notification-off-line"></i>
          Récap coupé : vous ne recevrez pas la synthèse hebdomadaire des échecs de rejeux.
        </p>
      )}
    </div>
  );
}