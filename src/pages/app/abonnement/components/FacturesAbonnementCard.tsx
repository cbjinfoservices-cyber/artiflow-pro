import { useEffect, useState } from "react";
import type { jsPDF } from "jspdf";
import { formatShortDate } from "@/lib/dates";
import { toCsv, downloadCsv } from "@/lib/csv";
import { pdfToBase64 } from "@/lib/pdf";
import ApercuPdfModal from "@/components/feature/ApercuPdfModal";
import {
  buildFacturesAbonnementPdf,
  buildRelevePrelevementsPdf,
  buildSommairePackComptablePdf,
} from "@/lib/abonnementFacturesPdf";
import { downloadZip, creerZip, blobToBase64, type ZipEntry } from "@/lib/zip";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useComptableEnvois } from "@/hooks/useComptableEnvois";
import type { ComptableEnvoi } from "@/lib/artisanApi";
import { formatDateHeure, natureEnvoi, perimetreEnvoi, compterEnvoisParAdresse, tendanceEnvoisParAdresse, updateComptablePackMessage, updateComptableReleveMessage, updateComptableCcEmail, updateComptableRenvoiDestinataire, updateComptableRemplacantHabituel } from "@/lib/comptableEnvois";
import {
  chargerFacturationAbonnement,
  envoyerPackComptableAuComptable,
  ouvrirPortailAbonnement,
  previsualiserPackComptable,
  previsualiserRappelPrelevement,
  urlRetourMonAbonnement,
  type ApercuEmailComptable,
  type FactureAbonnement,
} from "@/lib/abonnementPaiement";
import type { MonAbonnement } from "@/hooks/useMonAbonnement";
import ApercuRappelModal from "@/pages/app/abonnement/components/ApercuRappelModal";
import ApercuEmailComptableModal from "@/pages/app/abonnement/components/ApercuEmailComptableModal";
import HistoriqueEnvoisComptable, { type AdresseComptable } from "@/pages/app/abonnement/components/HistoriqueEnvoisComptable";
import Toast from "@/components/base/Toast";

function formatMontant(montant: number, devise: string): string {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: devise }).format(montant);
  } catch {
    return `${montant.toFixed(2)} ${devise}`;
  }
}

/** Total d'une liste de factures, ventilé par devise quand plusieurs devises coexistent. */
function totalParDevise(list: FactureAbonnement[]): string {
  const totaux = list.reduce<Record<string, number>>((acc, f) => {
    const cle = f.devise || "EUR";
    acc[cle] = (acc[cle] ?? 0) + f.montant;
    return acc;
  }, {});
  return Object.entries(totaux)
    .map(([devise, montant]) => formatMontant(montant, devise))
    .join(" + ");
}

/** Résumé lisible des statuts d'un groupe de factures (« 12 payées · 2 en attente · 1 impayée »). */
function resumeStatuts(list: FactureAbonnement[]): string {
  const payees = list.filter((f) => f.statut === "paid").length;
  const attente = list.filter((f) => f.statut === "open" || f.statut === "draft").length;
  const impayees = list.filter((f) => f.statut === "uncollectible").length;
  const parts: string[] = [];
  if (payees) parts.push(`${payees} payée${payees > 1 ? "s" : ""}`);
  if (attente) parts.push(`${attente} en attente`);
  if (impayees) parts.push(`${impayees} impayée${impayees > 1 ? "s" : ""}`);
  return parts.length ? parts.join(" · ") : "—";
}

function toneStatut(statut: string): string {
  switch (statut) {
    case "paid":
      return "bg-accent-100 text-accent-800";
    case "open":
      return "bg-secondary-100 text-secondary-800";
    case "uncollectible":
      return "bg-red-100 text-red-700";
    default:
      return "bg-background-200 text-foreground-600";
  }
}

type FiltreStatut = "tous" | "payee" | "attente" | "impayee";

const FILTRES_STATUT: { cle: FiltreStatut; label: string }[] = [
  { cle: "tous", label: "Tous" },
  { cle: "payee", label: "Payée" },
  { cle: "attente", label: "En attente" },
  { cle: "impayee", label: "Impayée" },
];

/** Un filtre par statut « regroupe » les statuts Stripe proches pour rester simple. */
function correspondStatut(facture: FactureAbonnement, filtre: FiltreStatut): boolean {
  switch (filtre) {
    case "payee":
      return facture.statut === "paid";
    case "attente":
      return facture.statut === "open" || facture.statut === "draft";
    case "impayee":
      return facture.statut === "uncollectible";
    default:
      return true;
  }
}

function LigneFacture({ facture, mention }: { facture: FactureAbonnement; mention: "HT" | "TTC" }) {
  const lien = facture.pdf || facture.url;
  return (
    <li className="flex flex-wrap items-center gap-3 py-3 border-t border-background-200 first:border-t-0">
      <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-background-200 text-foreground-600">
        <i className="ri-file-text-line"></i>
      </span>
      <div className="flex-1 min-w-[140px]">
        <p className="text-sm font-semibold text-foreground-900">
          {facture.numero !== "—" ? `Facture ${facture.numero}` : "Facture"}
        </p>
        <p className="text-xs text-foreground-500 mt-0.5">
          {facture.date ? formatShortDate(facture.date) : "Date inconnue"}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-baseline gap-1">
          <span className="font-heading font-semibold text-sm text-foreground-950">
            {formatMontant(facture.montant, facture.devise)}
          </span>
          <span className="text-[10px] font-bold text-foreground-400 uppercase tracking-wide">{mention}</span>
        </span>
        <span
          className={`inline-flex items-center h-6 px-2.5 rounded-full text-[10px] font-bold whitespace-nowrap ${toneStatut(facture.statut)}`}
        >
          {facture.statutLabel}
        </span>
        {lien ? (
          <a
            href={lien}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
          >
            <i className="ri-download-2-line"></i>
            PDF
          </a>
        ) : null}
      </div>
    </li>
  );
}

export default function FacturesAbonnementCard({ abonnement }: { abonnement: MonAbonnement }) {
  const { user, profile } = useAuth();
  const [etat, setEtat] = useState<"loading" | "ready" | "error">("loading");
  const [factures, setFactures] = useState<FactureAbonnement[]>([]);
  const [prochain, setProchain] = useState<{ montant: number; devise: string; date: string | null } | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [annee, setAnnee] = useState("toutes");
  const [statut, setStatut] = useState<FiltreStatut>("tous");
  const [montantsTtc, setMontantsTtc] = useState<boolean>(abonnement.montants_ttc);
  const [mentionErreur, setMentionErreur] = useState("");
  const [zipLoading, setZipLoading] = useState(false);
  const [zipExerciceLoading, setZipExerciceLoading] = useState(false);
  const [packLoading, setPackLoading] = useState(false);
  const [releveLoading, setReleveLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; fileName?: string } | null>(null);
  // Aperçu avant téléchargement des documents PDF de l'abonnement (factures, relevé).
  const [apercuDoc, setApercuDoc] = useState<{
    title: string;
    filename: string;
    build: () => Promise<jsPDF>;
  } | null>(null);
  const [comptableEmail, setComptableEmail] = useState("");
  const [comptableCc, setComptableCc] = useState("");
  const [natureEnvoiComptable, setNatureEnvoiComptable] = useState<"pack" | "releve">("pack");
  const [messagePack, setMessagePack] = useState("");
  const [messageReleve, setMessageReleve] = useState("");
  const [envoiComptableLoading, setEnvoiComptableLoading] = useState(false);
  const [renvoiPackLoading, setRenvoiPackLoading] = useState(false);
  const [renvoiReleveLoading, setRenvoiReleveLoading] = useState(false);
  // Destinataire effectivement ciblé par le renvoi en cours (adresse d'origine ou choisie).
  const [renvoiPackCible, setRenvoiPackCible] = useState("");
  const [renvoiReleveCible, setRenvoiReleveCible] = useState("");
  // Dernier destinataire de renvoi choisi (sélecteur de l'historique), mémorisé sur le profil
  // et reproposé pré-rempli à la prochaine session.
  const [destinataireRenvoi, setDestinataireRenvoi] = useState("");
  // Fenêtre d'annulation après un clic « Renvoyer au remplaçant habituel » : laisse quelques
  // secondes pour revenir en arrière au cas où le clic serait parti trop vite.
  const [annulationRemplacant, setAnnulationRemplacant] = useState<{ cible: string; secondes: number } | null>(null);
  const [envoiComptableErreur, setEnvoiComptableErreur] = useState("");
  const [envoiComptableNotice, setEnvoiComptableNotice] = useState("");
  const [memoriserLoading, setMemoriserLoading] = useState(false);
  const [apercuEmailOpen, setApercuEmailOpen] = useState(false);
  const [apercuEmail, setApercuEmail] = useState<ApercuEmailComptable | null>(null);
  const [apercuEmailLoading, setApercuEmailLoading] = useState(false);
  // Quelle action l'aperçu validera : l'envoi principal, le renvoi du dernier pack ou du relevé seul.
  const [apercuEmailAction, setApercuEmailAction] = useState<"envoi" | "renvoi" | "renvoi-releve">("envoi");
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailNotice, setTestEmailNotice] = useState("");
  const [testEmailErreur, setTestEmailErreur] = useState("");
  // Adresse de l'artisan, cible de l'« Envoyer un test à moi-même ».
  const monEmail = profile?.email || user?.email || "";

  // Adresses de comptable mémorisées : le cabinet principal (comptable_email) et les
  // adresses nommées du profil (ex. « Comptable remplaçant », « Cabinet externe »).
  // Proposées en sélection au moment de l'envoi pour éviter de les ressaisir.
  const adressesComptable: AdresseComptable[] = (() => {
    const list: AdresseComptable[] = [];
    const vus = new Set<string>();
    const ajouter = (label: string, email: string | null | undefined, role: "principal" | "remplacant") => {
      const propre = (email ?? "").trim();
      if (!propre || vus.has(propre.toLowerCase())) return;
      vus.add(propre.toLowerCase());
      list.push({ label, email: propre, role });
    };
    ajouter("Cabinet principal", profile?.comptable_email, "principal");
    (profile?.comptable_override_adresses ?? []).forEach((a) =>
      ajouter(a.nom || "Comptable remplaçant", a.email, "remplacant"),
    );
    return list;
  })();

  // Adresse enregistrée correspondant à l'adresse saisie (pour l'état du sélecteur), sinon "".
  const adresseComptableSelection =
    adressesComptable.find((a) => a.email.toLowerCase() === comptableEmail.trim().toLowerCase())?.email ?? "";

  // Historique des envois au comptable (date + destinataire), rechargé après chaque envoi.
  // On charge un large extrait pour pouvoir filtrer par nature et par destinataire.
  const {
    envois: envoisComptable,
    total: totalEnvoisComptable,
    reload: rechargerEnvoisComptable,
    loadMore: chargerPlusEnvoisComptable,
    loadingMore: chargerPlusLoading,
    hasMore: aPlusDEnvois,
  } = useComptableEnvois(40);

  // Compteur d'envois réels déjà effectués vers chaque adresse (clé en minuscules), affiché à
  // côté du nom dans le sélecteur d'adresse comptable enregistrée.
  const envoisParAdresse = compterEnvoisParAdresse(envoisComptable);
  // Sens d'évolution de l'usage de chaque adresse (flèche ↑/↓ à côté du compteur).
  const tendancesParAdresse = tendanceEnvoisParAdresse(envoisComptable);

  /** Affiche une confirmation d'export, en mémorisant le nom du fichier à pouvoir copier. */
  const notifier = (message: string, fileName?: string) => setToast({ message, fileName });

  const [apercuOpen, setApercuOpen] = useState(false);
  const [apercuHtml, setApercuHtml] = useState("");
  const [apercuLoading, setApercuLoading] = useState(false);
  const [apercuError, setApercuError] = useState("");

  useEffect(() => {
    setMontantsTtc(abonnement.montants_ttc);
  }, [abonnement.id, abonnement.montants_ttc]);

  // Pré-remplit l'adresse du comptable mémorisée sur le profil de l'artisan.
  useEffect(() => {
    if (profile?.comptable_email) setComptableEmail(profile.comptable_email);
  }, [profile?.comptable_email]);

  // Pré-remplit l'adresse secondaire mémorisée, mise en copie (Cc) des emails au comptable.
  useEffect(() => {
    if (profile?.comptable_cc_email) setComptableCc(profile.comptable_cc_email);
  }, [profile?.comptable_cc_email]);

  // Pré-remplit le dernier destinataire de renvoi choisi (mémorisé sur le profil).
  useEffect(() => {
    if (profile?.comptable_renvoi_destinataire) setDestinataireRenvoi(profile.comptable_renvoi_destinataire);
  }, [profile?.comptable_renvoi_destinataire]);

  // Pré-remplit les messages d'accompagnement mémorisés, un par nature (pack complet / relevé seul).
  useEffect(() => {
    if (profile?.comptable_pack_message) setMessagePack(profile.comptable_pack_message);
    if (profile?.comptable_releve_message) setMessageReleve(profile.comptable_releve_message);
  }, [profile?.comptable_pack_message, profile?.comptable_releve_message]);

  useEffect(() => {
    let actif = true;
    setEtat("loading");
    chargerFacturationAbonnement()
      .then((res) => {
        if (!actif) return;
        setFactures(res.factures);
        setProchain(res.prochain);
        setEtat("ready");
      })
      .catch(() => {
        if (actif) setEtat("error");
      });
    return () => {
      actif = false;
    };
  }, [abonnement.id, reloadKey]);

  const ouvrirPortail = async () => {
    setOuvert(true);
    try {
      const { url } = await ouvrirPortailAbonnement(urlRetourMonAbonnement());
      window.location.assign(url);
    } catch {
      setEtat("error");
      setOuvert(false);
    }
  };

  const previsualiser = async () => {
    if (!user?.id) {
      setApercuError("Connectez-vous pour prévisualiser le rappel.");
      return;
    }
    setApercuLoading(true);
    setApercuError("");
    try {
      const { html } = await previsualiserRappelPrelevement(user.id);
      setApercuHtml(html);
      setApercuOpen(true);
    } catch (e) {
      setApercuError(e instanceof Error ? e.message : "L'aperçu du rappel est indisponible pour l'instant.");
    } finally {
      setApercuLoading(false);
    }
  };

  const annees = Array.from(
    new Set(factures.map((f) => (f.date ? f.date.slice(0, 4) : "")).filter(Boolean)),
  ).sort((a, b) => Number(b) - Number(a));
  const anneeActive = annee === "toutes" || annees.includes(annee) ? annee : "toutes";
  const facturesFiltrees = factures
    .filter((f) => anneeActive === "toutes" || (f.date ?? "").startsWith(anneeActive))
    .filter((f) => correspondStatut(f, statut));

  const filtreActif = anneeActive !== "toutes" || statut !== "tous";

  const morceaux = [
    "factures",
    "abonnement",
    anneeActive !== "toutes" ? anneeActive : null,
    statut !== "tous" ? statut : null,
  ].filter(Boolean) as string[];

  // Total HT de la sélection, ventilé par devise si plusieurs devises coexistent.
  const totalLabel = totalParDevise(facturesFiltrees);
  const mention = montantsTtc ? "TTC" : "HT";

  // Récapitulatif par exercice (une ligne par année) pour l'en-tête de l'export PDF.
  const recapParAnnee = Array.from(new Set(facturesFiltrees.map((f) => (f.date ? f.date.slice(0, 4) : "—"))))
    .sort((a, b) => (a === "—" ? 1 : b === "—" ? -1 : Number(b) - Number(a)))
    .map((exercice) => {
      const liste = facturesFiltrees.filter((f) => (f.date ? f.date.slice(0, 4) : "—") === exercice);
      return { annee: exercice, nombre: liste.length, totalLabel: totalParDevise(liste), statuts: resumeStatuts(liste) };
    });

  // Résumé des statuts de toute la sélection, pour la ligne « Total (toutes années) » du récap.
  const recapTotalStatuts = resumeStatuts(facturesFiltrees);

  const filtreLabelStatut = statut === "tous" ? "Tous statuts" : FILTRES_STATUT.find((f) => f.cle === statut)?.label ?? "";

  const filtreLabel = `${anneeActive === "toutes" ? "Toutes années" : `Année ${anneeActive}`} · ${filtreLabelStatut}`;

  const nomBase = morceaux.join("-");

  const emetteurPdf = {
    entreprise: abonnement.entreprise,
    email: abonnement.email,
    metier: abonnement.metier,
  };

  const mapFacturesPdf = (liste: FactureAbonnement[]) =>
    liste.map((f) => ({
      numero: f.numero !== "—" ? f.numero : "—",
      dateLabel: f.date ? formatShortDate(f.date) : "Date inconnue",
      montant: f.montant,
      devise: f.devise,
      statutLabel: f.statutLabel,
    }));

  const construireCsv = () => {
    // Récap par exercice (avec la colonne Statut), en tête du fichier, puis le détail des lignes.
    const blocRecap = toCsv(
      ["Exercice", "Factures", `Total (${mention})`, "Statut"],
      [
        ...recapParAnnee.map((r) => [
          r.annee && r.annee !== "—" ? r.annee : "Date inconnue",
          String(r.nombre),
          r.totalLabel || "—",
          r.statuts || "—",
        ]),
        ["Total (toutes années)", String(facturesFiltrees.length), totalLabel || "—", recapTotalStatuts || "—"],
      ],
    );
    const blocDetail = toCsv(
      ["Année", "Date", "N° facture", `Montant (${mention})`, "Devise", "Statut"],
      facturesFiltrees.map((f) => [
        f.date ? f.date.slice(0, 4) : "—",
        f.date ?? "Date inconnue",
        f.numero !== "—" ? f.numero : "",
        f.montant.toFixed(2),
        f.devise,
        f.statutLabel,
      ]),
    );
    return `Récapitulatif par exercice\r\n${blocRecap}\r\n\r\nDétail des factures\r\n${blocDetail}`;
  };

  const construirePdf = () =>
    buildFacturesAbonnementPdf({
      emetteur: emetteurPdf,
      filtreLabel,
      offre: abonnement.offre,
      mention,
      totalLabel: totalLabel || "—",
      recapParAnnee,
      recapTotalStatuts,
      factures: mapFacturesPdf(facturesFiltrees),
    });

  // Relevé des prélèvements : même périmètre filtré, présenté comme une pièce comptable dédiée.
  const construireReleve = () =>
    buildRelevePrelevementsPdf({
      emetteur: emetteurPdf,
      filtreLabel,
      offre: abonnement.offre,
      mention,
      totalLabel: totalLabel || "—",
      prelevements: mapFacturesPdf(facturesFiltrees),
    });

  const exporterCsv = () => {
    downloadCsv(`${nomBase}.csv`, construireCsv());
    notifier(`CSV généré : ${nomBase}.csv`, `${nomBase}.csv`);
  };

  const exporterPdf = () => {
    // Aperçu avant téléchargement : on contrôle le récap par exercice et le détail des lignes.
    setApercuDoc({
      title: "Aperçu · Factures d'abonnement",
      filename: `${nomBase}.pdf`,
      build: async () => construirePdf(),
    });
  };

  // Relevé des prélèvements seul, à côté des autres exports.
  const exporterRelevePdf = () => {
    setReleveLoading(false);
    setApercuDoc({
      title: "Aperçu · Relevé des prélèvements",
      filename: `releve-prelevements-${nomBase}.pdf`,
      build: async () => construireReleve(),
    });
  };

  const exporterZip = async () => {
    setZipLoading(true);
    try {
      const doc = construirePdf();
      const pdfBlob = doc.output("blob");
      await downloadZip(`${nomBase}.zip`, [
        { name: `${nomBase}.pdf`, blob: pdfBlob },
        { name: `${nomBase}.csv`, content: construireCsv() },
      ]);
      notifier(`Archive générée : ${nomBase}.zip (PDF + CSV)`, `${nomBase}.zip`);
    } finally {
      setZipLoading(false);
    }
  };

  // Archive « un PDF par exercice » : un document distinct par année de la sélection.
  const exporterZipParExercice = async () => {
    setZipExerciceLoading(true);
    try {
      const exercices = Array.from(
        new Set(facturesFiltrees.map((f) => (f.date ? f.date.slice(0, 4) : "—"))),
      ).sort((a, b) => (a === "—" ? 1 : b === "—" ? -1 : Number(b) - Number(a)));

      const recapGlobal = buildFacturesAbonnementPdf({
        emetteur: emetteurPdf,
        filtreLabel,
        offre: abonnement.offre,
        mention,
        totalLabel: totalLabel || "—",
        recapParAnnee,
        recapTotalStatuts,
        factures: mapFacturesPdf(facturesFiltrees),
      });

      // Un nom de fichier sûr par exercice (« date-inconnue » quand l'année est absente).
      const nomFichierExercice = (ex: string) => (ex === "—" ? "date-inconnue" : ex);

      const entreesExercices = exercices.map((exercice) => {
        const liste = facturesFiltrees.filter((f) => (f.date ? f.date.slice(0, 4) : "—") === exercice);
        const doc = buildFacturesAbonnementPdf({
          emetteur: emetteurPdf,
          filtreLabel: `Année ${exercice === "—" ? "inconnue" : exercice} · ${filtreLabelStatut}`,
          offre: abonnement.offre,
          mention,
          totalLabel: totalParDevise(liste) || "—",
          factures: mapFacturesPdf(liste),
        });
        return {
          name: `factures-abonnement-${nomFichierExercice(exercice)}.pdf`,
          blob: doc.output("blob"),
          nombre: liste.length,
          annee: exercice,
        };
      });

      // Page de garde : sommaire des PDF annuels + périmètre de la sélection, en tête de l'archive.
      const sommaireExercices = buildSommairePackComptablePdf({
        emetteur: emetteurPdf,
        filtreLabel,
        offre: abonnement.offre,
        mention,
        totalLabel: totalLabel || "—",
        nombreFactures: facturesFiltrees.length,
        titre: "ARCHIVE PAR EXERCICE",
        sousTitre: "Un PDF par exercice de votre abonnement",
        fichiers: [
          {
            nom: "factures-abonnement-recapitulatif-global.pdf",
            description: "Récapitulatif global par exercice (avec statuts) et détail complet des factures.",
          },
          ...entreesExercices.map((e) => ({
            nom: e.name,
            description: `Factures de l'exercice ${e.annee === "—" ? "à date inconnue" : e.annee} (${e.nombre} facture${e.nombre > 1 ? "s" : ""}).`,
          })),
        ],
      });

      const entries = [
        { name: "00-page-de-garde.pdf", blob: sommaireExercices.output("blob") },
        { name: "factures-abonnement-recapitulatif-global.pdf", blob: recapGlobal.output("blob") },
        ...entreesExercices.map((e) => ({ name: e.name, blob: e.blob })),
      ];

      const nomZip = ["factures", "abonnement", "par-exercice", statut !== "tous" ? statut : null]
        .filter(Boolean)
        .join("-");
      await downloadZip(`${nomZip}.zip`, entries);
      notifier(
        `Archive générée : ${nomZip}.zip (page de garde + récapitulatif global + ${exercices.length} exercice${exercices.length > 1 ? "s" : ""})`,
        `${nomZip}.zip`,
      );
    } finally {
      setZipExerciceLoading(false);
    }
  };

  // Composition du « pack comptable » : page de garde + récapitulatif global + relevé des prélèvements + CSV.
  const nomsFichiersPack = [
    `${nomBase}-recapitulatif-global.pdf`,
    "releve-prelevements-abonnement.pdf",
    `${nomBase}.csv`,
  ];
  const nombreDocumentsPack = nomsFichiersPack.length + 1;

  // Page de garde : sommaire des documents + périmètre filtré, réutilisée par l'export ZIP et l'envoi email.
  const construireSommairePack = () =>
    buildSommairePackComptablePdf({
      emetteur: emetteurPdf,
      filtreLabel,
      offre: abonnement.offre,
      mention,
      totalLabel: totalLabel || "—",
      nombreFactures: facturesFiltrees.length,
      fichiers: [
        { nom: nomsFichiersPack[0], description: "Récapitulatif global par exercice (avec statuts) et détail complet des factures." },
        { nom: nomsFichiersPack[1], description: "Relevé des prélèvements : une ligne par prélèvement et son total." },
        { nom: nomsFichiersPack[2], description: "Export CSV de la sélection, prêt pour votre tableur comptable." },
      ],
    });

  // « Pack comptable » : un ZIP unique regroupant la page de garde, le récap global, le relevé des prélèvements et le CSV.
  const nomZipPack = ["pack-comptable", "abonnement", statut !== "tous" ? statut : null].filter(Boolean).join("-");

  // Composition du ZIP du pack comptable, réutilisée par le téléchargement et l'envoi email.
  const construireEntreesPackComptable = (): ZipEntry[] => {
    const recapGlobal = construirePdf();
    const releve = construireReleve();
    const sommaire = construireSommairePack();
    return [
      { name: "00-page-de-garde.pdf", blob: sommaire.output("blob") },
      { name: nomsFichiersPack[0], blob: recapGlobal.output("blob") },
      { name: nomsFichiersPack[1], blob: releve.output("blob") },
      { name: nomsFichiersPack[2], content: construireCsv() },
    ];
  };

  const exporterPackComptable = async () => {
    setPackLoading(true);
    try {
      await downloadZip(`${nomZipPack}.zip`, construireEntreesPackComptable());
      notifier(
        `Pack comptable généré : ${nomZipPack}.zip (page de garde + récap + relevé + CSV)`,
        `${nomZipPack}.zip`,
      );
    } finally {
      setPackLoading(false);
    }
  };

  // Assemble et envoie au comptable la pièce choisie : le pack complet (page de garde + relevé + ZIP)
  // ou le relevé des prélèvements seul (PDF). `mode` détermine la composition des pièces jointes.
  const envoyerPackAu = async (to: string, message: string, mode: "pack" | "releve", test = false) => {
    const releveFilename = `releve-prelevements-${nomBase}.pdf`;
    const releveBase64 = pdfToBase64(construireReleve());
    const commun = {
      to,
      mode,
      test,
      cc: test ? undefined : comptableCc.trim() || undefined,
      releveBase64,
      releveFilename,
      filtreLabel,
      offre: abonnement.offre,
      mention,
      totalLabel: totalLabel || "—",
      nombreFactures: facturesFiltrees.length,
      message: message.trim() || undefined,
    };
    if (mode === "releve") {
      // Relevé seul : une seule pièce jointe, aucun ZIP à générer.
      await envoyerPackComptableAuComptable(commun);
      return;
    }
    const pdfBase64 = pdfToBase64(construireSommairePack());
    const filename = `page-de-garde-pack-comptable-${nomBase}.pdf`;
    // Le pack comptable complet part aussi en pièce jointe, dans la même archive que le téléchargement.
    const zipFilename = `${nomZipPack}.zip`;
    const { blob } = await creerZip(construireEntreesPackComptable());
    const zipBase64 = await blobToBase64(blob);
    await envoyerPackComptableAuComptable({ ...commun, pdfBase64, filename, zipBase64, zipFilename });
  };

  // Message d'accompagnement de la nature sélectionnée (un texte mémorisé par nature).
  const messageCourant = natureEnvoiComptable === "releve" ? messageReleve : messagePack;

  // Construit le rendu exact de l'email et l'affiche dans la fenêtre de validation, pour
  // l'action donnée (envoi principal ou renvoi du dernier pack).
  const ouvrirApercuPour = async (
    to: string,
    mode: "pack" | "releve",
    message: string,
    action: "envoi" | "renvoi",
  ) => {
    setApercuEmailAction(action);
    setTestEmailNotice("");
    setTestEmailErreur("");
    setApercuEmailLoading(true);
    try {
      const apercu = await previsualiserPackComptable({
        to,
        cc: comptableCc.trim() || undefined,
        mode,
        filtreLabel,
        offre: abonnement.offre,
        mention,
        totalLabel: totalLabel || "—",
        nombreFactures: facturesFiltrees.length,
        message: message.trim() || undefined,
        filename: `page-de-garde-pack-comptable-${nomBase}.pdf`,
        releveFilename: `releve-prelevements-${nomBase}.pdf`,
        zipFilename: `${nomZipPack}.zip`,
      });
      setApercuEmail(apercu);
      setApercuEmailOpen(true);
    } catch (e) {
      setEnvoiComptableErreur(
        e instanceof Error ? e.message : "L'aperçu de l'email est indisponible pour l'instant.",
      );
    } finally {
      setApercuEmailLoading(false);
    }
  };

  // Ouvre l'aperçu de l'email (corps + pièces annoncées) AVANT l'envoi principal, pour valider.
  const ouvrirApercuEmail = async () => {
    const to = comptableEmail.trim();
    setEnvoiComptableErreur("");
    setEnvoiComptableNotice("");
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      setEnvoiComptableErreur("Saisissez une adresse email valide pour votre comptable.");
      return;
    }
    await ouvrirApercuPour(to, natureEnvoiComptable, messageCourant, "envoi");
  };

  // Envoie une copie de test à l'artisan lui-même, avec exactement les mêmes pièces jointes que
  // l'email qui partira au comptable, pour vérifier le rendu avant de transmettre. Non tracé.
  const envoyerEmailTest = async () => {
    setTestEmailNotice("");
    setTestEmailErreur("");
    if (!monEmail) {
      setTestEmailErreur("Aucune adresse email n'est associée à votre compte.");
      return;
    }
    const mode = apercuEmailAction === "renvoi" ? "pack" : apercuEmailAction === "renvoi-releve" ? "releve" : natureEnvoiComptable;
    const message = apercuEmailAction === "renvoi" ? messagePack : apercuEmailAction === "renvoi-releve" ? messageReleve : messageCourant;
    setTestEmailLoading(true);
    try {
      await envoyerPackAu(monEmail, message, mode, true);
      setTestEmailNotice(`Email de test envoyé à ${monEmail} (mêmes pièces jointes).`);
    } catch (e) {
      setTestEmailErreur(e instanceof Error ? e.message : "L'envoi du test a échoué.");
    } finally {
      setTestEmailLoading(false);
    }
  };

  // Envoie réellement (après validation dans l'aperçu) la pièce choisie au comptable saisi.
  const confirmerEnvoiComptable = async () => {
    // Si l'aperçu valide un renvoi du dernier pack, on emprunte le chemin de renvoi dédié.
    if (apercuEmailAction === "renvoi") {
      await confirmerRenvoiPack();
      return;
    }
    // Idem pour le renvoi du relevé des prélèvements seul.
    if (apercuEmailAction === "renvoi-releve") {
      await confirmerRenvoiReleve();
      return;
    }
    const to = comptableEmail.trim();
    setEnvoiComptableErreur("");
    setEnvoiComptableNotice("");
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      setEnvoiComptableErreur("Saisissez une adresse email valide pour votre comptable.");
      return;
    }
    const mode = natureEnvoiComptable;
    const message = mode === "releve" ? messageReleve : messagePack;
    setEnvoiComptableLoading(true);
    try {
      await envoyerPackAu(to, message, mode);
      // Mémorise le message utilisé, par nature (pack ou relevé seul), et l'adresse en copie.
      if (user?.id) {
        try {
          if (mode === "releve") await updateComptableReleveMessage(user.id, message);
          else await updateComptablePackMessage(user.id, message);
          await updateComptableCcEmail(user.id, comptableCc);
        } catch {
          /* best effort : l'envoi a réussi même si la mémorisation échoue */
        }
      }
      setEnvoiComptableNotice(
        mode === "releve"
          ? `Relevé des prélèvements envoyé à ${to} (PDF seul).`
          : `Pack comptable envoyé à ${to} (page de garde + relevé + ZIP complet).`,
      );
      notifier(
        mode === "releve" ? `Relevé envoyé à ${to}` : `Pack comptable envoyé à ${to}`,
        mode === "releve" ? `releve-prelevements-${nomBase}.pdf` : `${nomZipPack}.zip`,
      );
      setApercuEmailOpen(false);
      rechargerEnvoisComptable();
    } catch (e) {
      setEnvoiComptableErreur(e instanceof Error ? e.message : "L'envoi au comptable a échoué.");
    } finally {
      setEnvoiComptableLoading(false);
    }
  };

  // Dernier envoi de pack comptable, cible du bouton « Renvoyer le dernier pack ».
  // On ignore les envois de test (destinés à l'artisan lui-même) pour ne jamais réexpédier vers soi.
  const dernierPack = envoisComptable.find((e) => !e.test && (e.pieces ?? "").includes("pack-comptable")) ?? null;

  // Dernier envoi de relevé des prélèvements seul (hors pack), cible du bouton « Renvoyer le relevé seul ».
  const dernierReleve = envoisComptable.find((e) => !e.test && (e.pieces ?? "").includes("releve-prelevements")) ?? null;

  // Adresse du remplaçant habituel : la dernière utilisée (mémorisée sur le profil), sinon la
  // dernière repérée dans l'historique, sinon la première adresse remplaçante enregistrée.
  const remplacantHabituel = (() => {
    const stored = (profile?.comptable_remplacant_habituel ?? "").trim();
    if (stored) return stored;
    const emailsRemp = new Set(
      adressesComptable.filter((a) => a.role === "remplacant").map((a) => a.email.toLowerCase()),
    );
    const dernierRemp = envoisComptable.find(
      (e) => !e.test && e.destinataire && emailsRemp.has(e.destinataire.toLowerCase()),
    );
    if (dernierRemp?.destinataire) return dernierRemp.destinataire;
    return adressesComptable.find((a) => a.role === "remplacant")?.email ?? "";
  })();

  // Mémorise le destinataire d'un renvoi réussi (et, si c'est un remplaçant, la remplaçante habituelle).
  const memoriserDestinataireRenvoi = async (email: string) => {
    if (!user?.id) return;
    const propre = email.trim();
    if (!propre) return;
    try {
      await updateComptableRenvoiDestinataire(user.id, propre);
      const estRemplacant = adressesComptable.some(
        (a) => a.role === "remplacant" && a.email.toLowerCase() === propre.toLowerCase(),
      );
      if (estRemplacant) await updateComptableRemplacantHabituel(user.id, propre);
    } catch {
      /* best effort : le renvoi a réussi même si la mémorisation échoue */
    }
  };

  // Ouvre la même fenêtre de validation AVANT la réexpédition du dernier pack. Le destinataire
  // peut être choisi (adresse enregistrée) depuis l'historique ; sinon l'adresse d'origine est reprise.
  const ouvrirApercuRenvoiPack = async (destinataire?: string) => {
    const to = (destinataire ?? dernierPack?.destinataire ?? "").trim();
    setEnvoiComptableErreur("");
    setEnvoiComptableNotice("");
    if (!to) {
      setEnvoiComptableErreur("Aucun envoi de pack comptable à renvoyer pour l'instant.");
      return;
    }
    setRenvoiPackCible(to);
    await ouvrirApercuPour(to, "pack", messagePack, "renvoi");
  };

  // Expédie réellement (après validation dans l'aperçu) le dernier pack comptable au destinataire ciblé.
  const confirmerRenvoiPack = async () => {
    const to = (renvoiPackCible || dernierPack?.destinataire || "").trim();
    setEnvoiComptableErreur("");
    setEnvoiComptableNotice("");
    if (!to) {
      setEnvoiComptableErreur("Aucun envoi de pack comptable à renvoyer pour l'instant.");
      return;
    }
    setRenvoiPackLoading(true);
    try {
      await envoyerPackAu(to, messagePack, "pack");
      // Mémorise le message utilisé pour le reproposer pré-rempli au prochain renvoi, et l'adresse en copie.
      if (user?.id) {
        try {
          await updateComptablePackMessage(user.id, messagePack);
          await updateComptableCcEmail(user.id, comptableCc);
        } catch {
          /* best effort : le renvoi a réussi même si la mémorisation échoue */
        }
      }
      setEnvoiComptableNotice(`Pack comptable renvoyé à ${to} (page de garde + relevé + ZIP complet).`);
      notifier(`Pack comptable renvoyé à ${to}`, `${nomZipPack}.zip`);
      setApercuEmailOpen(false);
      rechargerEnvoisComptable();
      await memoriserDestinataireRenvoi(to);
    } catch (e) {
      setEnvoiComptableErreur(e instanceof Error ? e.message : "Le renvoi du pack a échoué.");
    } finally {
      setRenvoiPackLoading(false);
    }
  };

  // Ouvre la même fenêtre de validation AVANT la réexpédition du dernier relevé seul. Le destinataire
  // peut être choisi (adresse enregistrée) depuis l'historique ; sinon l'adresse d'origine est reprise.
  const ouvrirApercuRenvoiReleve = async (destinataire?: string) => {
    const to = (destinataire ?? dernierReleve?.destinataire ?? "").trim();
    setEnvoiComptableErreur("");
    setEnvoiComptableNotice("");
    if (!to) {
      setEnvoiComptableErreur("Aucun envoi de relevé des prélèvements à renvoyer pour l'instant.");
      return;
    }
    setRenvoiReleveCible(to);
    await ouvrirApercuPour(to, "releve", messageReleve, "renvoi-releve");
  };

  // Expédie réellement (après validation dans l'aperçu) le dernier relevé seul au destinataire ciblé.
  const confirmerRenvoiReleve = async () => {
    const to = (renvoiReleveCible || dernierReleve?.destinataire || "").trim();
    setEnvoiComptableErreur("");
    setEnvoiComptableNotice("");
    if (!to) {
      setEnvoiComptableErreur("Aucun envoi de relevé des prélèvements à renvoyer pour l'instant.");
      return;
    }
    setRenvoiReleveLoading(true);
    try {
      await envoyerPackAu(to, messageReleve, "releve");
      // Mémorise le message du relevé et l'adresse en copie (best effort).
      if (user?.id) {
        try {
          await updateComptableReleveMessage(user.id, messageReleve);
          await updateComptableCcEmail(user.id, comptableCc);
        } catch {
          /* best effort : le renvoi a réussi même si la mémorisation échoue */
        }
      }
      setEnvoiComptableNotice(`Relevé des prélèvements renvoyé à ${to} (PDF seul).`);
      notifier(`Relevé des prélèvements renvoyé à ${to}`, `releve-prelevements-${nomBase}.pdf`);
      setApercuEmailOpen(false);
      rechargerEnvoisComptable();
      await memoriserDestinataireRenvoi(to);
    } catch (e) {
      setEnvoiComptableErreur(e instanceof Error ? e.message : "Le renvoi du relevé a échoué.");
    } finally {
      setRenvoiReleveLoading(false);
    }
  };

  // Renvoie le dernier pack au remplaçant habituel, en un clic : pré-sélectionne l'adresse
  // remplaçante mémorisée puis ouvre la même fenêtre d'aperçu avant réexpédition.
  const ouvrirApercuRenvoiRemplacant = async (cible?: string) => {
    const to = (cible || remplacantHabituel).trim();
    if (!to) return;
    setDestinataireRenvoi(to);
    await ouvrirApercuRenvoiPack(to);
  };

  // Clic « Renvoyer au remplaçant habituel » : on n'ouvre pas tout de suite l'aperçu, on laisse
  // d'abord une courte fenêtre d'annulation au cas où le clic serait parti trop vite.
  const demanderRenvoiRemplacant = () => {
    if (!remplacantHabituel) return;
    setAnnulationRemplacant({ cible: remplacantHabituel, secondes: 5 });
  };

  // Décompte de la fenêtre d'annulation : à zéro, on enchaîne sur l'aperçu du renvoi.
  useEffect(() => {
    if (!annulationRemplacant) return;
    if (annulationRemplacant.secondes <= 0) {
      const cible = annulationRemplacant.cible;
      setAnnulationRemplacant(null);
      void ouvrirApercuRenvoiRemplacant(cible);
      return;
    }
    const minuteur = setTimeout(() => {
      setAnnulationRemplacant((prev) => (prev ? { ...prev, secondes: prev.secondes - 1 } : prev));
    }, 1000);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annulationRemplacant]);

  // Mémorise explicitement le message d'accompagnement du renvoi (nature pack), pour les prochains renvois.
  const memoriserMessagePack = async () => {
    if (!user?.id) return;
    setMemoriserLoading(true);
    try {
      await updateComptablePackMessage(user.id, messagePack);
      notifier(
        messagePack.trim()
          ? "Message d'accompagnement mémorisé pour les renvois."
          : "Message d'accompagnement effacé (message par défaut rétabli).",
      );
    } catch {
      setEnvoiComptableErreur("Impossible de mémoriser le message pour l'instant.");
    } finally {
      setMemoriserLoading(false);
    }
  };

  // Mémorise le message d'accompagnement de la nature courante (pack ou relevé seul), pour l'envoi principal.
  const memoriserMessageCourant = async () => {
    if (!user?.id) return;
    setMemoriserLoading(true);
    try {
      if (natureEnvoiComptable === "releve") {
        await updateComptableReleveMessage(user.id, messageReleve);
        notifier(
          messageReleve.trim()
            ? "Message du relevé mémorisé."
            : "Message du relevé effacé (message par défaut rétabli).",
        );
      } else {
        await updateComptablePackMessage(user.id, messagePack);
        notifier(
          messagePack.trim()
            ? "Message du pack mémorisé."
            : "Message du pack effacé (message par défaut rétabli).",
        );
      }
      // Mémorise aussi l'adresse secondaire (Cc) pour la reproposer au prochain envoi.
      await updateComptableCcEmail(user.id, comptableCc);
    } catch {
      setEnvoiComptableErreur("Impossible de mémoriser le message pour l'instant.");
    } finally {
      setMemoriserLoading(false);
    }
  };

  // Exporte en CSV la liste d'envois affichée (filtrée par nature et/ou destinataire).
  const exporterHistoriqueEnvoisCsv = (liste: ComptableEnvoi[]) => {
    const nom = "historique-envois-comptable.csv";
    const contenu = toCsv(
      ["Date", "Destinataire", "Nature", "Périmètre"],
      liste.map((e) => [
        formatDateHeure(e.envoye_le),
        e.destinataire || "Destinataire inconnu",
        natureEnvoi(e),
        perimetreEnvoi(e),
      ]),
    );
    downloadCsv(nom, contenu);
    notifier(`Historique exporté : ${nom} (${liste.length} envoi${liste.length > 1 ? "s" : ""})`, nom);
  };

  const basculerMention = async (valeurTtc: boolean) => {
    if (valeurTtc === montantsTtc) return;
    setMontantsTtc(valeurTtc);
    setMentionErreur("");
    try {
      const { error } = await supabase
        .from("abonnements")
        .update({ montants_ttc: valeurTtc, updated_at: new Date().toISOString() })
        .eq("id", abonnement.id);
      if (error) throw error;
    } catch {
      setMontantsTtc(!valeurTtc);
      setMentionErreur("Impossible d'enregistrer votre préférence pour l'instant.");
    }
  };

  // Copie le nom du dernier fichier exporté, pour le coller directement dans un dossier comptable.
  const copierNomFichier = async () => {
    const nom = toast?.fileName;
    if (!nom) return;
    try {
      await navigator.clipboard.writeText(nom);
      setToast({ message: `Nom copié : ${nom}`, fileName: nom });
    } catch {
      setToast({ message: "Copie impossible — sélectionnez le nom à la main.", fileName: nom });
    }
  };

  return (
    <section className="flex flex-col gap-4 p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-xl">
            <i className="ri-receipt-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-semibold text-base text-foreground-950">Mes factures et prélèvements</h3>
            <p className="text-xs text-foreground-500">
              Vos reçus Stripe et la date de votre prochain prélèvement.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={previsualiser}
            disabled={apercuLoading}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {apercuLoading ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-open-line"></i>}
            Prévisualiser le rappel J-3
          </button>
          <button
            type="button"
            onClick={ouvrirPortail}
            disabled={ouvert}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {ouvert ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-external-link-line"></i>}
            Ouvrir mes factures
          </button>
        </div>
      </div>

      {apercuError ? (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{apercuError}</p>
      ) : null}

      {etat === "loading" ? (
        <div className="flex items-center gap-2 py-5 text-sm text-foreground-500">
          <i className="ri-loader-4-line animate-spin"></i>
          Chargement de vos factures…
        </div>
      ) : etat === "error" ? (
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg bg-background-50 border border-background-200">
          <i className="ri-error-warning-line text-primary-600 text-lg"></i>
          <p className="text-sm text-foreground-600 flex-1 min-w-[180px]">
            Impossible de charger vos factures pour l'instant.
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Réessayer
          </button>
        </div>
      ) : (
        <>
          {prochain ? (
            <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg bg-accent-100/70 border border-accent-300/60">
              <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50">
                <i className="ri-calendar-schedule-line text-lg"></i>
              </span>
              <div className="flex-1 min-w-[160px]">
                <p className="text-[11px] font-semibold text-accent-800 uppercase tracking-wide">
                  Prochain prélèvement
                </p>
                <p className="inline-flex items-baseline gap-1.5">
                  <span className="font-heading font-bold text-lg text-foreground-950">
                    {formatMontant(prochain.montant, prochain.devise)}
                  </span>
                  <span className="text-[11px] font-bold text-foreground-400 uppercase tracking-wide">
                    {mention}
                  </span>
                </p>
              </div>
              <p className="text-sm text-accent-900 font-medium">
                {prochain.date ? `le ${formatShortDate(prochain.date)}` : "date à venir"}
              </p>
            </div>
          ) : null}

          {factures.length === 0 ? (
            <div className="flex flex-col items-center text-center py-8 px-4 rounded-lg bg-background-50 border border-background-200">
              <span className="w-11 h-11 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700 text-xl">
                <i className="ri-file-list-3-line"></i>
              </span>
              <p className="mt-3 text-sm font-medium text-foreground-800">Aucune facture pour l'instant</p>
              <p className="mt-1 text-xs text-foreground-500 max-w-sm">
                Vos factures apparaîtront ici dès le premier prélèvement de votre abonnement.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 p-4 rounded-lg bg-background-50 border border-background-200">
                {annees.length > 1 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-foreground-500 uppercase tracking-wide mr-1">
                      Année
                    </span>
                    <button
                      type="button"
                      onClick={() => setAnnee("toutes")}
                      className={`inline-flex items-center h-7 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        anneeActive === "toutes"
                          ? "bg-primary-500 text-background-50"
                          : "bg-background-100 border border-background-200 text-foreground-600 hover:border-primary-300"
                      }`}
                    >
                      Toutes
                    </button>
                    {annees.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAnnee(a)}
                        className={`inline-flex items-center h-7 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                          anneeActive === a
                            ? "bg-primary-500 text-background-50"
                            : "bg-background-100 border border-background-200 text-foreground-600 hover:border-primary-300"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-foreground-500 uppercase tracking-wide mr-1">
                      Statut
                    </span>
                    {FILTRES_STATUT.map((f) => (
                      <button
                        key={f.cle}
                        type="button"
                        onClick={() => setStatut(f.cle)}
                        aria-pressed={statut === f.cle}
                        className={`inline-flex items-center h-7 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                          statut === f.cle
                            ? "bg-secondary-500 text-background-50"
                            : "bg-background-100 border border-background-200 text-foreground-600 hover:border-secondary-300"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                        Montants
                      </span>
                      <div className="inline-flex items-center h-8 p-0.5 rounded-md bg-background-100 border border-background-200">
                        <button
                          type="button"
                          onClick={() => basculerMention(true)}
                          aria-pressed={montantsTtc}
                          className={`inline-flex items-center h-7 px-2.5 rounded text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                            montantsTtc
                              ? "bg-primary-500 text-background-50"
                              : "text-foreground-600 hover:bg-background-200"
                          }`}
                        >
                          TTC
                        </button>
                        <button
                          type="button"
                          onClick={() => basculerMention(false)}
                          aria-pressed={!montantsTtc}
                          className={`inline-flex items-center h-7 px-2.5 rounded text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                            !montantsTtc
                              ? "bg-primary-500 text-background-50"
                              : "text-foreground-600 hover:bg-background-200"
                          }`}
                        >
                          HT
                        </button>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-accent-100/70 border border-accent-300/60">
                      <span className="w-4 h-4 flex items-center justify-center text-accent-700">
                        <i className="ri-money-euro-circle-line text-xs"></i>
                      </span>
                      <span className="text-[11px] font-semibold text-accent-800 uppercase tracking-wide whitespace-nowrap">
                        Total {mention}
                      </span>
                      <span className="font-heading font-bold text-xs text-foreground-950 whitespace-nowrap">
                        {totalLabel || "—"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={exporterCsv}
                      disabled={facturesFiltrees.length === 0}
                      className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className="ri-file-download-line"></i>
                      Exporter CSV
                    </button>
                    <button
                      type="button"
                      onClick={exporterPdf}
                      disabled={facturesFiltrees.length === 0}
                      className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className="ri-file-pdf-2-line"></i>
                      Exporter en PDF
                    </button>
                    <button
                      type="button"
                      onClick={exporterRelevePdf}
                      disabled={facturesFiltrees.length === 0 || releveLoading}
                      className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {releveLoading ? (
                        <i className="ri-loader-4-line animate-spin"></i>
                      ) : (
                        <i className="ri-file-list-2-line"></i>
                      )}
                      Relevé PDF
                    </button>
                    <button
                      type="button"
                      onClick={exporterZip}
                      disabled={facturesFiltrees.length === 0 || zipLoading}
                      className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {zipLoading ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-file-zip-line"></i>}
                      Exporter ZIP
                    </button>
                    <button
                      type="button"
                      onClick={exporterZipParExercice}
                      disabled={facturesFiltrees.length === 0 || zipExerciceLoading}
                      className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {zipExerciceLoading ? (
                        <i className="ri-loader-4-line animate-spin"></i>
                      ) : (
                        <i className="ri-folders-line"></i>
                      )}
                      ZIP par exercice
                    </button>
                    <div className="group relative">
                      <button
                        type="button"
                        onClick={exporterPackComptable}
                        disabled={facturesFiltrees.length === 0 || packLoading}
                        aria-describedby="tooltip-pack-comptable"
                        className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {packLoading ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-briefcase-4-line"></i>}
                        Pack comptable
                      </button>
                      <div
                        id="tooltip-pack-comptable"
                        role="tooltip"
                        className="pointer-events-none absolute bottom-full right-0 mb-2 w-64 p-3 rounded-lg bg-foreground-950 text-left opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 transition-all duration-150 z-30"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wide text-background-300">
                          Contenu du pack comptable
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-background-50">
                          <strong className="font-heading">{nombreDocumentsPack} fichiers</strong> : page de garde, récapitulatif global, relevé des prélèvements et CSV.
                        </p>
                        <p className="mt-1.5 text-[11px] text-background-300">
                          Périmètre : {filtreLabel} · {facturesFiltrees.length} facture{facturesFiltrees.length > 1 ? "s" : ""} · total {mention} {totalLabel || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                {mentionErreur ? (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {mentionErreur}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 p-3 rounded-lg bg-secondary-100/60 border border-secondary-200/70">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-secondary-500 text-background-50">
                    <i className="ri-mail-send-line"></i>
                  </span>
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-xs font-semibold text-foreground-900">Envoyer au comptable</p>
                    <p className="text-[11px] text-foreground-500">
                      {natureEnvoiComptable === "releve"
                        ? "Le relevé des prélèvements seul (PDF) part en pièce jointe, avec le périmètre de la sélection."
                        : "La page de garde, le relevé seul et le pack comptable complet (ZIP) partent en pièces jointes."}
                    </p>
                  </div>
                  {adressesComptable.length > 0 ? (
                    <div className="relative" title="Choisir une adresse de comptable enregistrée">
                      <i className="ri-bookmark-3-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
                      <select
                        value={adresseComptableSelection}
                        onChange={(e) => {
                          if (e.target.value) setComptableEmail(e.target.value);
                        }}
                        className="h-9 w-full sm:w-64 pl-9 pr-8 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none cursor-pointer focus:ring-2 focus:ring-primary-300 appearance-none"
                      >
                        <option value="">Adresse enregistrée…</option>
                        {adressesComptable.map((a) => {
                          const nb = envoisParAdresse[a.email.toLowerCase()] ?? 0;
                          const tendance = tendancesParAdresse[a.email.toLowerCase()];
                          const fleche = tendance === "hausse" ? " ↑" : tendance === "baisse" ? " ↓" : "";
                          return (
                            <option key={a.email} value={a.email}>
                              {a.label} — {a.email}
                              {nb > 0 ? ` (${nb} renvoi${nb > 1 ? "s" : ""}${fleche})` : ""}
                            </option>
                          );
                        })}
                      </select>
                      <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
                    </div>
                  ) : null}
                  <div className="relative">
                    <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
                    <input
                      type="email"
                      value={comptableEmail}
                      onChange={(e) => setComptableEmail(e.target.value)}
                      placeholder="comptable@cabinet.fr"
                      className="h-9 w-full sm:w-56 pl-9 pr-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>
                  <div className="relative" title="Adresse secondaire mise en copie (Cc) — mémorisée sur votre profil">
                    <i className="ri-mail-add-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
                    <input
                      type="email"
                      value={comptableCc}
                      onChange={(e) => setComptableCc(e.target.value)}
                      placeholder="En copie (Cc) — optionnel"
                      className="h-9 w-full sm:w-56 pl-9 pr-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center h-9 p-1 rounded-full bg-background-100 border border-background-200">
                    <button
                      type="button"
                      onClick={() => setNatureEnvoiComptable("pack")}
                      aria-pressed={natureEnvoiComptable === "pack"}
                      className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        natureEnvoiComptable === "pack"
                          ? "bg-primary-500 text-background-50"
                          : "text-foreground-600 hover:bg-background-200"
                      }`}
                    >
                      <i className="ri-briefcase-4-line"></i>
                      Pack complet
                    </button>
                    <button
                      type="button"
                      onClick={() => setNatureEnvoiComptable("releve")}
                      aria-pressed={natureEnvoiComptable === "releve"}
                      className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        natureEnvoiComptable === "releve"
                          ? "bg-primary-500 text-background-50"
                          : "text-foreground-600 hover:bg-background-200"
                      }`}
                    >
                      <i className="ri-file-list-2-line"></i>
                      Relevé seul
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={ouvrirApercuEmail}
                    disabled={facturesFiltrees.length === 0 || envoiComptableLoading || apercuEmailLoading}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {apercuEmailLoading ? (
                      <i className="ri-loader-4-line animate-spin"></i>
                    ) : (
                      <i className="ri-mail-open-line"></i>
                    )}
                    Aperçu de l'email et envoi
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="message-comptable" className="text-[11px] font-semibold text-foreground-600 uppercase tracking-wide">
                      Message d'accompagnement — {natureEnvoiComptable === "releve" ? "relevé seul" : "pack complet"}
                    </label>
                    <span className="text-[11px] text-foreground-400 tabular-nums whitespace-nowrap">
                      {messageCourant.length} / 500
                    </span>
                  </div>
                  <textarea
                    id="message-comptable"
                    name="message_comptable"
                    value={messageCourant}
                    maxLength={500}
                    onChange={(e) =>
                      natureEnvoiComptable === "releve"
                        ? setMessageReleve(e.target.value)
                        : setMessagePack(e.target.value)
                    }
                    rows={3}
                    placeholder={
                      natureEnvoiComptable === "releve"
                        ? "Bonjour, veuillez trouver ci-joint le relevé des prélèvements de notre abonnement. Bien cordialement,"
                        : "Bonjour, veuillez trouver ci-joint le pack comptable de notre abonnement pour le trimestre. Bien cordialement,"
                    }
                    className="w-full resize-none rounded-md bg-background-50 border border-background-200 px-3 py-2 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-foreground-500">
                      Un texte mémorisé par nature (pack / relevé seul). Laissé vide, le message par défaut est utilisé.
                    </p>
                    <button
                      type="button"
                      onClick={memoriserMessageCourant}
                      disabled={memoriserLoading}
                      className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {memoriserLoading ? (
                        <i className="ri-loader-4-line animate-spin"></i>
                      ) : (
                        <i className="ri-bookmark-line"></i>
                      )}
                      Mémoriser message et copie
                    </button>
                  </div>
                </div>
              </div>

              {envoiComptableErreur ? (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-center gap-1.5">
                  <i className="ri-error-warning-line"></i>
                  {envoiComptableErreur}
                </p>
              ) : null}
              {envoiComptableNotice ? (
                <p className="text-xs text-accent-800 bg-accent-100/70 border border-accent-300/60 rounded-md px-3 py-2 flex items-center gap-1.5">
                  <i className="ri-checkbox-circle-line"></i>
                  {envoiComptableNotice}
                </p>
              ) : null}

              {annulationRemplacant ? (
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-accent-100/70 border border-accent-300/60">
                  <p className="inline-flex items-center gap-2 text-xs text-accent-900">
                    <i className="ri-timer-line text-base"></i>
                    <span>
                      Renvoi du dernier pack au remplaçant habituel
                      {annulationRemplacant.cible ? ` (${annulationRemplacant.cible})` : ""} dans{" "}
                      <strong className="font-heading tabular-nums">{annulationRemplacant.secondes}</strong>{" "}
                      s… vous pouvez encore annuler.
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setAnnulationRemplacant(null)}
                    className="inline-flex items-center gap-1.5 h-8 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
                  >
                    <i className="ri-close-line"></i>
                    Annuler
                  </button>
                </div>
              ) : null}

              <HistoriqueEnvoisComptable
                envois={envoisComptable}
                renvoiDisponible={Boolean(dernierPack)}
                renvoiDestinataire={dernierPack?.destinataire ?? null}
                renvoiLoading={renvoiPackLoading}
                onRenvoi={ouvrirApercuRenvoiPack}
                renvoiReleveId={dernierReleve?.id ?? null}
                renvoiReleveDestinataire={dernierReleve?.destinataire ?? null}
                renvoiReleveLoading={renvoiReleveLoading}
                onRenvoiReleve={ouvrirApercuRenvoiReleve}
                adressesComptable={adressesComptable}
                destinataireRenvoi={destinataireRenvoi}
                onDestinataireRenvoiChange={setDestinataireRenvoi}
                remplacantHabituel={remplacantHabituel}
                onRenvoiRemplacant={demanderRenvoiRemplacant}
                messageRenvoi={messagePack}
                onMessageRenvoiChange={setMessagePack}
                onMemoriserMessage={memoriserMessagePack}
                memoriserLoading={memoriserLoading}
                onExporterCsv={exporterHistoriqueEnvoisCsv}
                onLoadMore={chargerPlusEnvoisComptable}
                loadingMore={chargerPlusLoading}
                hasMore={aPlusDEnvois}
                total={totalEnvoisComptable}
              />

              <ul className="rounded-lg bg-background-50 border border-background-200 px-4">
                {facturesFiltrees.length === 0 ? (
                  <li className="flex flex-wrap items-center gap-3 py-6 justify-center text-center">
                    <span className="w-9 h-9 flex items-center justify-center rounded-full bg-background-200 text-foreground-500">
                      <i className="ri-filter-off-line"></i>
                    </span>
                    <p className="text-sm text-foreground-500">
                      Aucune facture ne correspond à ces filtres.
                      {filtreActif
                        ? " Essayez « Toutes » pour voir l'ensemble de votre historique."
                        : ""}
                    </p>
                  </li>
                ) : (
                  facturesFiltrees.map((facture) => (
                    <LigneFacture key={facture.id || facture.numero} facture={facture} mention={mention} />
                  ))
                )}
              </ul>
            </>
          )}
        </>
      )}

      <ApercuRappelModal open={apercuOpen} html={apercuHtml} onClose={() => setApercuOpen(false)} />
      {apercuDoc && (
        <ApercuPdfModal
          title={apercuDoc.title}
          subtitle="Vérifiez la mise en page (colonnes, libellés, totaux) avant de télécharger le PDF."
          filename={apercuDoc.filename}
          docBuilder={apercuDoc.build}
          note="Aucun fichier n'est enregistré tant que vous n'avez pas cliqué sur « Télécharger le PDF »."
          onClose={() => setApercuDoc(null)}
        />
      )}
      <ApercuEmailComptableModal
        open={apercuEmailOpen}
        apercu={apercuEmail}
        envoyant={envoiComptableLoading || renvoiPackLoading || renvoiReleveLoading}
        onClose={() => setApercuEmailOpen(false)}
        onConfirm={confirmerEnvoiComptable}
        onTest={envoyerEmailTest}
        testLoading={testEmailLoading}
        testEmail={monEmail || null}
        testNotice={testEmailNotice}
        testErreur={testEmailErreur}
      />
      {toast ? (
        <Toast
          message={toast.message}
          onClose={() => setToast(null)}
          icon="ri-check-line"
          duration={3600}
          actionLabel={toast.fileName ? "Copier le nom" : undefined}
          actionIcon="ri-file-copy-line"
          onAction={toast.fileName ? copierNomFichier : undefined}
        />
      ) : null}
    </section>
  );
}