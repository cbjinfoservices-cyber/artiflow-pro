import { useEffect, useMemo, useState } from "react";
import type { AutoItem } from "@/lib/envoisAutomatiques";
import { capacitesEnvoiAuto, rejouerEnBlanc, type ResultatBlanc } from "@/lib/envoisAutomatiquesActions";
import {
  TEST_A_BLANC_EVENT,
  emailValide,
  enregistrerFiltresRejeux,
  enregistrerTestABlanc,
  lireFiltresRejeux,
  lireTestABlanc,
  type PeriodeRejeux,
  type TestABlancPrefs,
} from "@/lib/testABlancPrefs";
import { formatDateHeure } from "@/lib/envoisAutomatiquesHistorique";
import {
  TEST_A_BLANC_HISTO_EVENT,
  lireRejeuxBlancs,
  viderRejeuxBlancs,
  type RejeuBlancEntree,
} from "@/lib/testABlancHistorique";
import { enregistrerRecapEmail } from "@/lib/testABlancRecapMemoire";
import { toCsv, downloadCsv } from "@/lib/csv";
import { envoyerCsvParEmail, envoyerRecapEchecsCsv } from "@/lib/diagnosticEmail";

interface Props {
  /** Les automatisations suivies (pour ne rejouer que celles qui ont un aperçu). */
  items: AutoItem[];
  /** Identifiant du profil connecté, nécessaire aux aperçus. */
  userId: string;
}

/**
 * Panneau « Mode test à blanc » : rejoue le contenu EXACT d'une automatisation vers une
 * adresse de test, sans jamais expédier aux vrais destinataires (clients, comptable).
 * Sert à valider le rendu réel des emails avant de publier, en toute sécurité.
 */
export default function TestABlancPanel({ items, userId }: Props) {
  const [prefs, setPrefs] = useState<TestABlancPrefs>(() => lireTestABlanc());
  const [saisie, setSaisie] = useState(() => lireTestABlanc().destinataire);
  const [enCours, setEnCours] = useState(false);
  const [resultats, setResultats] = useState<Record<string, ResultatBlanc>>({});
  const [resume, setResume] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // Historique local des derniers rejeux (date, automatisation, adresse de test).
  const [histo, setHisto] = useState<RejeuBlancEntree[]>(() => lireRejeuxBlancs());
  // Filtre par automatisation (vide = toutes), mémorisé d'une session à l'autre.
  const [filtreAuto, setFiltreAuto] = useState<string>(() => lireFiltresRejeux().filtreAuto);
  // Filtre par résultat (envoyée / échec), mémorisé lui aussi.
  const [filtreResultat, setFiltreResultat] = useState<"tous" | "ok" | "echec">(
    () => lireFiltresRejeux().filtreResultat,
  );
  // Filtre par période (aujourd'hui / 7 jours / plage personnalisée / tout), mémorisé comme les autres.
  const [filtrePeriode, setFiltrePeriode] = useState<PeriodeRejeux>(
    () => lireFiltresRejeux().filtrePeriode,
  );
  // Bornes de la plage personnalisée (dates « AAAA-MM-JJ »), mémorisées elles aussi.
  const [dateDebut, setDateDebut] = useState<string>(() => lireFiltresRejeux().dateDebut);
  const [dateFin, setDateFin] = useState<string>(() => lireFiltresRejeux().dateFin);
  // Envoi de l'export par email : trace datée conservée hors du navigateur.
  const [envoiEmail, setEnvoiEmail] = useState<{ etat: "envoi" | "ok" | "erreur"; message: string } | null>(
    null,
  );
  // Envoi du récap d'échecs (CSV joint) par email, pour archiver tout l'historique d'un coup.
  const [envoiRecap, setEnvoiRecap] = useState<{ etat: "envoi" | "ok" | "erreur"; message: string } | null>(
    null,
  );
  // Relance en série des automatisations en échec (bouton « Tout relancer » du résumé).
  const [relanceEchecs, setRelanceEchecs] = useState(false);

  // Relit l'historique des rejeux à chaque mise à jour (unitaire ou global depuis le Diagnostic).
  useEffect(() => {
    const relire = () => setHisto(lireRejeuxBlancs());
    window.addEventListener(TEST_A_BLANC_HISTO_EVENT, relire);
    return () => window.removeEventListener(TEST_A_BLANC_HISTO_EVENT, relire);
  }, []);

  // Relit les préférences à chaque mise à jour (persistance locale).
  useEffect(() => {
    const relire = () => {
      const p = lireTestABlanc();
      setPrefs(p);
      setSaisie(p.destinataire);
    };
    window.addEventListener(TEST_A_BLANC_EVENT, relire);
    return () => window.removeEventListener(TEST_A_BLANC_EVENT, relire);
  }, []);

  // Seules les automatisations disposant d'un aperçu peuvent être rejouées à blanc.
  const eligibles = useMemo(() => items.filter((i) => capacitesEnvoiAuto(i.id).apercu), [items]);

  // Automatisations présentes dans l'historique (pour alimenter le filtre).
  const automatisationsHisto = useMemo(() => {
    const map = new Map<string, string>();
    histo.forEach((h) => {
      if (!map.has(h.id)) map.set(h.id, h.nom);
    });
    return Array.from(map.entries()).map(([id, nom]) => ({ id, nom }));
  }, [histo]);

  // Borne basse (timestamp) de la période choisie : 0 = pas de borne basse (tout l'historique).
  const debutPeriode = useMemo(() => {
    if (filtrePeriode === "tout") return 0;
    if (filtrePeriode === "perso") {
      if (!dateDebut) return 0;
      const d = new Date(`${dateDebut}T00:00:00`);
      return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    }
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (filtrePeriode === "7j") d.setDate(d.getDate() - 6);
    else if (filtrePeriode === "30j") d.setDate(d.getDate() - 29);
    else if (filtrePeriode === "6m") d.setMonth(d.getMonth() - 6);
    return d.getTime();
  }, [filtrePeriode, dateDebut]);

  // Borne haute (timestamp) : 0 = pas de borne haute. Utile uniquement en plage personnalisée.
  const finPeriode = useMemo(() => {
    if (filtrePeriode !== "perso" || !dateFin) return 0;
    const d = new Date(`${dateFin}T23:59:59.999`);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }, [filtrePeriode, dateFin]);

  // Historique filtré sur l'automatisation, le résultat ET la période (tous si aucun filtre).
  const histoFiltre = useMemo(
    () =>
      histo.filter(
        (h) =>
          (!filtreAuto || h.id === filtreAuto) &&
          (filtreResultat === "tous" || (filtreResultat === "ok" ? h.ok : !h.ok)) &&
          (debutPeriode === 0 || new Date(h.date).getTime() >= debutPeriode) &&
          (finPeriode === 0 || new Date(h.date).getTime() <= finPeriode),
      ),
    [histo, filtreAuto, filtreResultat, debutPeriode, finPeriode],
  );

  // Y a-t-il au moins un filtre actif ? (pour proposer une remise à zéro claire)
  const filtreActif =
    filtreAuto !== "" ||
    filtreResultat !== "tous" ||
    filtrePeriode !== "tout" ||
    dateDebut !== "" ||
    dateFin !== "";

  // Résumé chiffré de la sélection filtrée : repérer les ratés d'un coup d'œil.
  const okFiltre = useMemo(() => histoFiltre.filter((h) => h.ok).length, [histoFiltre]);
  const echecsFiltre = histoFiltre.length - okFiltre;

  // Automatisations distinctes présentes en échec dans la sélection (pour « Tout relancer »).
  const echecsUniques = useMemo(() => {
    const map = new Map<string, string>();
    histoFiltre.forEach((h) => {
      if (!h.ok && !map.has(h.id)) map.set(h.id, h.nom);
    });
    return Array.from(map.entries()).map(([id, nom]) => ({ id, nom }));
  }, [histoFiltre]);

  // Mémorise les filtres pour qu'ils restent en place après un rechargement de la page.
  useEffect(() => {
    enregistrerFiltresRejeux({ filtreAuto, filtreResultat, filtrePeriode, dateDebut, dateFin });
  }, [filtreAuto, filtreResultat, filtrePeriode, dateDebut, dateFin]);

  // Remet tous les filtres de rejeux à zéro (y compris la plage personnalisée).
  const reinitialiserFiltres = () => {
    setFiltreAuto("");
    setFiltreResultat("tous");
    setFiltrePeriode("tout");
    setDateDebut("");
    setDateFin("");
  };

  // Libellé lisible de la période filtrée, pour l'en-tête CSV et le nom du fichier.
  const libellePeriode = (): string => {
    switch (filtrePeriode) {
      case "jour":
        return "aujourd'hui";
      case "7j":
        return "7 derniers jours";
      case "30j":
        return "30 derniers jours";
      case "6m":
        return "6 derniers mois";
      case "perso":
        return dateDebut || dateFin ? `du ${dateDebut || "…"} au ${dateFin || "…"}` : "plage personnalisée";
      default:
        return "toute la période";
    }
  };

  const suffixePeriode = (): string => {
    switch (filtrePeriode) {
      case "jour":
        return "jour";
      case "7j":
        return "7j";
      case "30j":
        return "30j";
      case "6m":
        return "6m";
      case "perso":
        return dateDebut || dateFin ? `${dateDebut || "debut"}_${dateFin || "fin"}` : "perso";
      default:
        return "tout";
    }
  };

  // Construit le CSV daté de l'historique FILTRÉ sur la période choisie (commun au téléchargement
  // et à l'email), pour uniformiser le filtrage entre l'affichage et l'export.
  const construireCsv = () => {
    const headers = ["Date", "Automatisation", "Adresse de test", "Résultat"];
    const rows = histoFiltre.map((h) => [
      formatDateHeure(h.date),
      h.nom,
      h.destinataire,
      h.ok ? "Envoyée" : "Échec",
    ]);
    const jour = new Date().toISOString().slice(0, 10);
    const entete = `Historique des rejeux - periode : ${libellePeriode()}`;
    const contenu = `${entete}\r\n${toCsv(headers, rows)}`;
    return { contenu, filename: `rejeux-test-a-blanc-${suffixePeriode()}-${jour}.csv` };
  };

  // Export CSV de l'historique FILTRÉ (garder une trace datée à archiver avant publication).
  const exporterCsv = () => {
    if (histoFiltre.length === 0) return;
    const { contenu, filename } = construireCsv();
    downloadCsv(filename, contenu);
  };

  // Envoie le même export (filtré sur la même période) par email à l'adresse de l'artisan : la
  // trace datée survit au navigateur, et le filtrage reste identique à l'affichage.
  const envoyerCsvEmail = async () => {
    if (histoFiltre.length === 0 || envoiEmail?.etat === "envoi") return;
    const { contenu, filename } = construireCsv();
    setEnvoiEmail({ etat: "envoi", message: "Envoi de l'export en cours…" });
    try {
      const res = await envoyerCsvParEmail({
        csv: contenu,
        filename,
        subject: `Rejeux test à blanc — ${libellePeriode()}`,
      });
      setEnvoiEmail({ etat: "ok", message: `Export envoyé par email à ${res.to || "votre adresse"}.` });
    } catch (e) {
      setEnvoiEmail({
        etat: "erreur",
        message: e instanceof Error ? e.message : "L'envoi de l'export par email a échoué.",
      });
    }
  };

  // Envoie par email un récap d'ÉCHECS (CSV joint) qui regroupe les échecs par automatisation,
  // pour archiver tout l'historique des rejeux d'un seul geste.
  const envoyerRecapEchecs = async () => {
    if (envoiRecap?.etat === "envoi") return;
    // On ne regroupe que les échecs, par automatisation (nom -> nombre + dernier échec).
    const parAuto = new Map<string, { nom: string; echecs: number; dernier: string }>();
    histo.forEach((h) => {
      if (h.ok) return;
      const cur = parAuto.get(h.id);
      if (cur) {
        cur.echecs += 1;
        if (new Date(h.date).getTime() > new Date(cur.dernier).getTime()) cur.dernier = h.date;
      } else {
        parAuto.set(h.id, { nom: h.nom, echecs: 1, dernier: h.date });
      }
    });
    const groupes = Array.from(parAuto.values()).sort((a, b) => b.echecs - a.echecs);
    if (groupes.length === 0) {
      setEnvoiRecap({ etat: "ok", message: "Aucun échec dans l'historique : rien à envoyer, tout est vert." });
      return;
    }
    setEnvoiRecap({ etat: "envoi", message: "Envoi du récap des échecs en cours…" });
    try {
      // CSV en deux blocs : synthèse des échecs par automatisation, puis détail complet.
      const jour = new Date().toISOString().slice(0, 10);
      const syntheseCsv = toCsv(
        ["Automatisation", "Nb échecs", "Dernier échec"],
        groupes.map((g) => [g.nom, String(g.echecs), formatDateHeure(g.dernier)]),
      );
      const detailCsv = toCsv(
        ["Automatisation", "Date", "Adresse de test", "Résultat"],
        histo.map((h) => [h.nom, formatDateHeure(h.date), h.destinataire, h.ok ? "Envoyée" : "Échec"]),
      );
      const contenu = `Échecs par automatisation (${groupes.length})\r\n${syntheseCsv}\r\n\r\nDétail de l'historique\r\n${detailCsv}`;
      const filename = `echecs-rejeux-${jour}.csv`;
      const res = await envoyerRecapEchecsCsv({
        csv: contenu,
        filename,
        groupes: groupes.map((g) => ({
          nom: g.nom,
          echecs: g.echecs,
          dernier: formatDateHeure(g.dernier),
        })),
        total: histo.length,
        dateExporte: new Date().toISOString(),
      });
      enregistrerRecapEmail();
      setEnvoiRecap({
        etat: "ok",
        message: `Récap des ${groupes.length} automatisation${groupes.length > 1 ? "s" : ""} en échec envoyé à ${res.to || "votre adresse"}.`,
      });
    } catch (e) {
      setEnvoiRecap({
        etat: "erreur",
        message: e instanceof Error ? e.message : "L'envoi du récap des échecs a échoué.",
      });
    }
  };

  const basculerMode = () => {
    const dest = saisie.trim();
    if (!prefs.actif && !emailValide(dest)) {
      setErreur("Renseignez une adresse de test valide avant d'activer le mode test à blanc.");
      return;
    }
    const suivant: TestABlancPrefs = { actif: !prefs.actif, destinataire: dest };
    setErreur(null);
    enregistrerTestABlanc(suivant);
    setPrefs(suivant);
  };

  const validerDestinataire = () => {
    const dest = saisie.trim();
    if (!emailValide(dest)) {
      setErreur("Cette adresse de test n'est pas valide.");
      return;
    }
    setErreur(null);
    const suivant: TestABlancPrefs = { actif: prefs.actif, destinataire: dest };
    enregistrerTestABlanc(suivant);
    setPrefs(suivant);
  };

  const rejouerTout = async () => {
    const dest = (prefs.destinataire || saisie).trim();
    if (!emailValide(dest)) {
      setErreur("Renseignez d'abord une adresse de test valide.");
      return;
    }
    if (!userId || eligibles.length === 0 || enCours) return;
    setEnCours(true);
    setErreur(null);
    setResume(null);
    setResultats({});
    const acc: Record<string, ResultatBlanc> = {};
    let ok = 0;
    // Rejeu en série pour ne pas saturer les envois.
    for (const item of eligibles) {
      const res = await rejouerEnBlanc(item.id, item.nom, userId, dest);
      acc[item.id] = res;
      if (res.ok) ok += 1;
      setResultats({ ...acc });
    }
    setEnCours(false);
    setResume(`${ok}/${eligibles.length} copie(s) de test à blanc envoyée(s) à ${dest}.`);
  };

  const rejouerUn = async (item: AutoItem) => {
    const dest = (prefs.destinataire || saisie).trim();
    if (!emailValide(dest)) {
      setErreur("Renseignez d'abord une adresse de test valide.");
      return;
    }
    if (!userId || enCours) return;
    setErreur(null);
    const res = await rejouerEnBlanc(item.id, item.nom, userId, dest);
    setResultats((r) => ({ ...r, [item.id]: res }));
  };

  // Relance en test à blanc toutes les automatisations qui apparaissent en échec dans la
  // sélection courante : on repart directement sur des rendus frais sans tout rejouer.
  const relancerEchecs = async () => {
    const dest = (prefs.destinataire || saisie).trim();
    if (!emailValide(dest)) {
      setErreur("Renseignez d'abord une adresse de test valide.");
      return;
    }
    if (!userId || echecsUniques.length === 0 || relanceEchecs) return;
    setRelanceEchecs(true);
    setErreur(null);
    setResume(null);
    setResultats({});
    let ok = 0;
    // Relance en série pour ne pas saturer les envois.
    for (const item of echecsUniques) {
      const res = await rejouerEnBlanc(item.id, item.nom, userId, dest);
      if (res.ok) ok += 1;
    }
    setRelanceEchecs(false);
    setResume(
      `${ok}/${echecsUniques.length} automatisation(s) en échec relancée(s) en test à blanc vers ${dest}.`,
    );
  };

  const destValide = emailValide(prefs.destinataire || saisie);

  return (
    <section className="flex flex-col gap-4 p-5 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-lg">
            <i className="ri-flask-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-semibold text-base text-foreground-950">Mode test à blanc</h3>
            <p className="mt-0.5 text-xs text-foreground-600 max-w-xl leading-relaxed">
              Rejouez le contenu exact d'une automatisation vers une adresse de test, sans jamais rien
              envoyer à vos clients ni à votre comptable. Idéal pour valider le rendu avant de publier.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={basculerMode}
          role="switch"
          aria-checked={prefs.actif}
          title={prefs.actif ? "Désactiver le mode test à blanc" : "Activer le mode test à blanc"}
          className={`shrink-0 inline-flex items-center gap-2.5 h-10 px-4 rounded-md border text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            prefs.actif
              ? "bg-accent-500 border-accent-500 text-background-50 hover:bg-accent-600"
              : "bg-background-50 border-background-200 text-foreground-600 hover:bg-background-200"
          }`}
        >
          <i className={prefs.actif ? "ri-toggle-fill" : "ri-toggle-line"}></i>
          {prefs.actif ? "Test à blanc activé" : "Test à blanc désactivé"}
        </button>
      </div>

      {/* Adresse de test */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-2 h-11 px-3 rounded-md bg-background-50 border border-background-200 flex-1 min-w-0">
          <i className="ri-mail-line text-foreground-400 text-sm"></i>
          <input
            type="email"
            value={saisie}
            onChange={(e) => {
              setSaisie(e.target.value);
              setErreur(null);
            }}
            placeholder="destinataire-de-test@exemple.fr"
            aria-label="Adresse de test pour le mode test à blanc"
            className="w-full bg-transparent text-sm text-foreground-900 placeholder:text-foreground-400 outline-none"
          />
        </div>
        <button
          type="button"
          onClick={validerDestinataire}
          disabled={!emailValide(saisie)}
          className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className="ri-save-3-line"></i>
          Enregistrer l'adresse
        </button>
      </div>

      {/* Ce que fait un test à blanc */}
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <li className="flex items-start gap-2 p-3 rounded-md bg-background-50 border border-background-200">
          <i className="ri-shield-check-line text-accent-600 mt-px shrink-0"></i>
          <span className="text-[11px] text-foreground-600 leading-relaxed">
            Aucun envoi vers un <strong className="text-foreground-800">client</strong> ni votre{" "}
            <strong className="text-foreground-800">comptable</strong>.
          </span>
        </li>
        <li className="flex items-start gap-2 p-3 rounded-md bg-background-50 border border-background-200">
          <i className="ri-file-copy-2-line text-primary-600 mt-px shrink-0"></i>
          <span className="text-[11px] text-foreground-600 leading-relaxed">
            Le contenu reproduit est <strong className="text-foreground-800">exactement</strong> celui de l'envoi réel.
          </span>
        </li>
        <li className="flex items-start gap-2 p-3 rounded-md bg-background-50 border border-background-200">
          <i className="ri-test-tube-line text-secondary-600 mt-px shrink-0"></i>
          <span className="text-[11px] text-foreground-600 leading-relaxed">
            Chaque copie porte un bandeau <strong className="text-foreground-800">TEST À BLANC</strong> bien visible.
          </span>
        </li>
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => { void rejouerTout(); }}
          disabled={!prefs.actif || enCours || !destValide || eligibles.length === 0 || !userId}
          title={
            !prefs.actif
              ? "Activez d'abord le mode test à blanc"
              : !destValide
                ? "Renseignez une adresse de test valide"
                : `Rejouer ${eligibles.length} automatisation(s) vers l'adresse de test`
          }
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-accent-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {enCours ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-play-circle-line"></i>}
          {enCours ? "Rejeu en cours…" : `Rejouer les ${eligibles.length} automatisations en blanc`}
        </button>
        <span className="text-[11px] text-foreground-500">
          {eligibles.length} automatisation{eligibles.length > 1 ? "s" : ""} rejouable
          {eligibles.length > 1 ? "s" : ""} · les autres partiront vers un tiers, sans copie de test possible.
        </span>
      </div>

      {erreur && (
        <p className="flex items-start gap-2 text-[11px] text-red-600 leading-relaxed">
          <i className="ri-error-warning-line mt-px shrink-0"></i>
          <span>{erreur}</span>
        </p>
      )}
      {resume && (
        <p className="flex items-start gap-2 text-[11px] text-accent-700 leading-relaxed">
          <i className="ri-checkbox-circle-line mt-px shrink-0"></i>
          <span>{resume}</span>
        </p>
      )}

      {/* Liste des automatisations rejouables, avec leur état de rejeu */}
      <ul className="flex flex-col divide-y divide-background-200 rounded-lg border border-background-200 bg-background-50 overflow-hidden">
        {eligibles.map((item) => {
          const res = resultats[item.id];
          return (
            <li key={item.id} className="flex flex-col gap-1.5 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <i className={`${item.icone} text-foreground-500`}></i>
                  <span className="text-sm font-semibold text-foreground-950 truncate">{item.nom}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {res && (
                    <span
                      className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
                        res.ok ? "bg-accent-100 text-accent-800" : "bg-red-100 text-red-700"
                      }`}
                    >
                      <i className={res.ok ? "ri-check-line" : "ri-close-line"}></i>
                      {res.ok ? "Copie envoyée" : "Échec"}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => { void rejouerUn(item); }}
                    disabled={!prefs.actif || enCours || !destValide || !userId}
                    title="Rejouer cette automatisation en test à blanc"
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-background-200 bg-background-100 text-foreground-600 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <i className="ri-play-line"></i>
                    Rejouer
                  </button>
                </div>
              </div>
              {res && !res.ok && (
                <p className="text-[11px] text-red-600 leading-relaxed flex items-start gap-1.5">
                  <i className="ri-error-warning-line mt-px shrink-0"></i>
                  {res.message}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <p className="flex items-start gap-2 text-[11px] text-foreground-500 leading-relaxed">
        <i className="ri-information-line mt-px shrink-0"></i>
        <span>
          Le test à blanc <strong>ne déclenche pas</strong> la logique de l'automatisation (aucun compteur, aucune
          relance, aucun changement de statut) : il se contente de reproduire le rendu de l'email. Pour exécuter
          réellement une automatisation vers vous, utilisez « Tester maintenant » sur sa carte.
        </span>
      </p>

      {/* Historique local des derniers rejeux : ce qui a déjà été validé avant publication. */}
      <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-background-50 border border-background-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-foreground-800">
            <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
              <i className="ri-history-line"></i>
            </span>
            Derniers rejeux à blanc
            {histoFiltre.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-background-200 text-foreground-600 text-[10px] font-bold">
                {histoFiltre.length}
              </span>
            )}
          </span>
          {histo.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Filtre par automatisation */}
              <div className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-background-200 bg-background-100">
                <i className="ri-filter-3-line text-foreground-400 text-xs"></i>
                <select
                  value={filtreAuto}
                  onChange={(e) => setFiltreAuto(e.target.value)}
                  aria-label="Filtrer les rejeux par automatisation"
                  className="bg-transparent text-[11px] font-semibold text-foreground-700 outline-none cursor-pointer"
                >
                  <option value="">Toutes les automatisations</option>
                  {automatisationsHisto.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nom}
                    </option>
                  ))}
                </select>
              </div>
              {/* Filtre par résultat (envoyée / échec) pour repérer les rejeux ratés */}
              <div className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-background-200 bg-background-100">
                <i className="ri-checkbox-circle-line text-foreground-400 text-xs"></i>
                <select
                  value={filtreResultat}
                  onChange={(e) => setFiltreResultat(e.target.value as "tous" | "ok" | "echec")}
                  aria-label="Filtrer les rejeux par résultat"
                  className="bg-transparent text-[11px] font-semibold text-foreground-700 outline-none cursor-pointer"
                >
                  <option value="tous">Tous les résultats</option>
                  <option value="ok">Envoyée</option>
                  <option value="echec">Échec</option>
                </select>
              </div>
              {/* Filtre par période (aujourd'hui / 7 jours / plage personnalisée / tout) */}
              <div className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-background-200 bg-background-100">
                <i className="ri-calendar-line text-foreground-400 text-xs"></i>
                <select
                  value={filtrePeriode}
                  onChange={(e) => setFiltrePeriode(e.target.value as PeriodeRejeux)}
                  aria-label="Filtrer les rejeux par période"
                  className="bg-transparent text-[11px] font-semibold text-foreground-700 outline-none cursor-pointer"
                >
                  <option value="tout">Toute la période</option>
                  <option value="jour">Aujourd'hui</option>
                  <option value="7j">7 derniers jours</option>
                  <option value="30j">30 derniers jours</option>
                  <option value="6m">6 derniers mois</option>
                  <option value="perso">Plage personnalisée</option>
                </select>
              </div>
              {/* Plage personnalisée : bornes de début et de fin (visibles seulement si choisie) */}
              {filtrePeriode === "perso" && (
                <div className="flex items-center gap-1.5 h-7 pl-2 pr-1 rounded-md border border-secondary-300 bg-background-100">
                  <span className="text-[10px] font-semibold text-foreground-500">Du</span>
                  <input
                    type="date"
                    value={dateDebut}
                    max={dateFin || undefined}
                    onChange={(e) => setDateDebut(e.target.value)}
                    aria-label="Date de début de la plage"
                    className="bg-transparent text-[11px] font-semibold text-foreground-700 outline-none cursor-pointer"
                  />
                  <span className="text-[10px] font-semibold text-foreground-500">au</span>
                  <input
                    type="date"
                    value={dateFin}
                    min={dateDebut || undefined}
                    onChange={(e) => setDateFin(e.target.value)}
                    aria-label="Date de fin de la plage"
                    className="bg-transparent text-[11px] font-semibold text-foreground-700 outline-none cursor-pointer"
                  />
                  {(dateDebut || dateFin) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDateDebut("");
                        setDateFin("");
                      }}
                      title="Effacer les dates"
                      className="w-5 h-5 flex items-center justify-center rounded-full text-foreground-400 cursor-pointer hover:bg-background-200 hover:text-foreground-700 transition-colors"
                    >
                      <i className="ri-close-line text-xs"></i>
                    </button>
                  )}
                </div>
              )}
              {/* Export CSV de l'historique daté */}
              <button
                type="button"
                onClick={exporterCsv}
                disabled={histoFiltre.length === 0}
                title={
                  histoFiltre.length === 0
                    ? "Rien à exporter pour ce filtre"
                    : `Exporter l'historique des rejeux (${libellePeriode()}) en CSV`
                }
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-background-200 text-[11px] font-semibold text-foreground-500 whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-download-2-line"></i>
                Exporter CSV
              </button>
              {/* Envoi du même export (filtré sur la même période) par email : la trace datée survit au navigateur */}
              <button
                type="button"
                onClick={() => { void envoyerCsvEmail(); }}
                disabled={envoiEmail?.etat === "envoi" || histoFiltre.length === 0}
                title="Envoyer l'export (sur la période filtrée) par email à votre adresse pour garder une trace datée"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-background-200 text-[11px] font-semibold text-foreground-500 whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className={envoiEmail?.etat === "envoi" ? "ri-loader-4-line animate-spin" : "ri-mail-send-line"}></i>
                {envoiEmail?.etat === "envoi" ? "Envoi…" : "Envoyer par email"}
              </button>
              {/* Récap d'échecs regroupés par automatisation (CSV joint), pour tout archiver d'un coup */}
              <button
                type="button"
                onClick={() => { void envoyerRecapEchecs(); }}
                disabled={envoiRecap?.etat === "envoi"}
                title="Envoyer par email un récap des échecs regroupés par automatisation, avec le CSV en pièce jointe"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-background-200 text-[11px] font-semibold text-foreground-500 whitespace-nowrap cursor-pointer hover:border-red-300 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className={envoiRecap?.etat === "envoi" ? "ri-loader-4-line animate-spin" : "ri-file-warning-line"}></i>
                {envoiRecap?.etat === "envoi" ? "Envoi…" : "Récap échecs (CSV)"}
              </button>
              <button
                type="button"
                onClick={() => {
                  viderRejeuxBlancs();
                  setHisto([]);
                  setFiltreAuto("");
                  setFiltreResultat("tous");
                  setFiltrePeriode("tout");
                  setDateDebut("");
                  setDateFin("");
                  setEnvoiEmail(null);
                  setEnvoiRecap(null);
                }}
                title="Effacer l'historique local des rejeux à blanc"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-background-200 text-[11px] font-semibold text-foreground-500 whitespace-nowrap cursor-pointer hover:border-secondary-300 hover:text-secondary-800 transition-colors"
              >
                <i className="ri-eraser-line"></i>
                Vider l'historique
              </button>
            </div>
          )}
        </div>
        {histo.length === 0 ? (
          <p className="text-[11px] text-foreground-500 leading-relaxed">
            Aucun rejeu pour l'instant. Chaque test à blanc (unitaire ou global depuis le Diagnostic) sera consigné
            ici : date, automatisation et adresse de test.
          </p>
        ) : histoFiltre.length === 0 ? (
          <p className="text-[11px] text-foreground-500 leading-relaxed">
            Aucun rejeu ne correspond {filtreActif ? "aux filtres choisis" : "à ce filtre"}.{" "}
            <button
              type="button"
              onClick={reinitialiserFiltres}
              className="font-semibold text-primary-700 hover:underline cursor-pointer"
            >
              Réinitialiser les filtres
            </button>
          </p>
        ) : (
          <>
            {/* Résumé chiffré de la sélection : total, échecs et réussites d'un coup d'œil. */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] leading-relaxed">
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground-700">
                <i className="ri-list-check-2 text-foreground-400"></i>
                {histoFiltre.length} rejeu{histoFiltre.length > 1 ? "x" : ""}
                {filtreActif ? " (filtrés)" : ""}
              </span>
              <span className="text-foreground-300">·</span>
              <span
                className={`inline-flex items-center gap-1.5 font-semibold ${
                  echecsFiltre > 0 ? "text-red-600" : "text-foreground-500"
                }`}
              >
                <i className={echecsFiltre > 0 ? "ri-error-warning-line" : "ri-checkbox-circle-line"}></i>
                {echecsFiltre} échec{echecsFiltre > 1 ? "s" : ""}
              </span>
              <span className="text-foreground-300">·</span>
              <span className="inline-flex items-center gap-1.5 text-accent-700 font-semibold">
                <i className="ri-check-line"></i>
                {okFiltre} envoyée{okFiltre > 1 ? "s" : ""}
              </span>
              {/* Relance d'un coup les automatisations en échec de la sélection courante. */}
              {echecsFiltre > 0 && (
                <button
                  type="button"
                  onClick={() => { void relancerEchecs(); }}
                  disabled={relanceEchecs || !destValide || !userId}
                  title={
                    !destValide
                      ? "Renseignez d'abord une adresse de test valide"
                      : `Relancer ${echecsUniques.length} automatisation(s) en échec vers l'adresse de test`
                  }
                  className="inline-flex items-center gap-1.5 h-6 px-2.5 sm:ml-auto rounded-md bg-red-100 text-red-700 text-[11px] font-bold whitespace-nowrap cursor-pointer hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {relanceEchecs ? (
                    <i className="ri-loader-4-line animate-spin"></i>
                  ) : (
                    <i className="ri-restart-line"></i>
                  )}
                  {relanceEchecs ? "Relance…" : "Tout relancer"}
                </button>
              )}
            </div>
            <ul className="flex flex-col divide-y divide-background-200 rounded-lg border border-background-200 bg-background-100 overflow-hidden">
              {histoFiltre.slice(0, 20).map((h, index) => (
                <li key={`${h.date}-${index}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
                  <span
                    className={`w-6 h-6 shrink-0 flex items-center justify-center rounded-md ${
                      h.ok ? "bg-accent-100 text-accent-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    <i className={h.ok ? "ri-check-line" : "ri-close-line"}></i>
                  </span>
                  <span className="text-[11px] text-foreground-500 whitespace-nowrap">{formatDateHeure(h.date)}</span>
                  <span className="flex-1 min-w-[160px] text-xs font-semibold text-foreground-900 truncate">
                    {h.nom}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground-500 truncate max-w-[220px]">
                    <i className="ri-mail-line"></i>
                    {h.destinataire}
                  </span>
                </li>
              ))}
            </ul>
            {histoFiltre.length > 20 && (
              <p className="text-[10px] text-foreground-400">
                Les 20 rejeux les plus récents sont affichés ({histoFiltre.length} au total pour ce filtre).
              </p>
            )}
            <p className="flex items-start gap-1.5 text-[10px] text-foreground-400 leading-relaxed">
              <i className="ri-information-line mt-px shrink-0"></i>
              L'export CSV (téléchargement et email) reprend la même période que l'affichage : « {libellePeriode()} ».
            </p>
          </>
        )}
        {envoiEmail && (
          <p
            className={`flex items-start gap-1.5 text-[11px] leading-relaxed ${
              envoiEmail.etat === "erreur"
                ? "text-red-600"
                : envoiEmail.etat === "ok"
                  ? "text-accent-700"
                  : "text-foreground-500"
            }`}
          >
            <i
              className={`mt-px shrink-0 ${
                envoiEmail.etat === "erreur"
                  ? "ri-error-warning-line"
                  : envoiEmail.etat === "ok"
                    ? "ri-checkbox-circle-line"
                    : "ri-loader-4-line animate-spin"
              }`}
            ></i>
            <span>{envoiEmail.message}</span>
          </p>
        )}
        {envoiRecap && (
          <p
            className={`flex items-start gap-1.5 text-[11px] leading-relaxed ${
              envoiRecap.etat === "erreur"
                ? "text-red-600"
                : envoiRecap.etat === "ok"
                  ? "text-accent-700"
                  : "text-foreground-500"
            }`}
          >
            <i
              className={`mt-px shrink-0 ${
                envoiRecap.etat === "erreur"
                  ? "ri-error-warning-line"
                  : envoiRecap.etat === "ok"
                    ? "ri-checkbox-circle-line"
                    : "ri-loader-4-line animate-spin"
              }`}
            ></i>
            <span>{envoiRecap.message}</span>
          </p>
        )}
      </div>
    </section>
  );
}