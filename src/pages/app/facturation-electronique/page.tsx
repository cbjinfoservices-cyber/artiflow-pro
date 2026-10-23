import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/hooks/useAuth";
import { useArtisanData, type FactureItem } from "@/hooks/useArtisanData";
import { formatShortDate, todayISO } from "@/lib/dates";
import { formatEuros } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { downloadZip } from "@/lib/zip";
import { buildFacturePdfById } from "@/lib/facturePdf";
import { pdfToBase64, savePdf } from "@/lib/pdf";
import { buildRejetsEfacturePdf } from "@/lib/rejetsEfacturePdf";
import { envoyerFicheRejetsComptable } from "@/lib/rejetsEfactureEmail";
import { useHistoriqueEfactures } from "@/hooks/useHistoriqueEfactures";
import {
  EF_STATUT_META,
  buildFacturXXml,
  buildRegistreCsv,
  controlerConformite,
  nomFichierXml,
  telechargerXml,
  type EfClient,
  type EfEmetteur,
  type EfFactureSource,
  type EfLigne,
  type EfStatut,
} from "@/lib/factureElectronique";
import { updateEfactureStatut, updateReglagesEfacture } from "@/lib/factureElectroniqueApi";
import DataState from "@/pages/app/components/DataState";
import Modal from "@/pages/app/components/Modal";
import ApercuPdfModal from "@/components/feature/ApercuPdfModal";
import EncartAide from "@/components/base/EncartAide";
import ConformiteEfactureCard from "@/pages/app/facturation-electronique/components/ConformiteEfactureCard";
import RegistreEfacturesCard from "@/pages/app/facturation-electronique/components/RegistreEfacturesCard";
import TelechargerXmlMoisCard from "@/pages/app/facturation-electronique/components/TelechargerXmlMoisCard";
import ReglagesEfactureCard from "@/pages/app/facturation-electronique/components/ReglagesEfactureCard";

/** Reconstruit une ligne unique quand la copie des lignes n'est pas disponible. */
function lignesDepuisFacture(f: FactureItem): EfLigne[] {
  if (f.lignes && f.lignes.length > 0) {
    return f.lignes.map((l) => ({
      designation: l.designation,
      unite: l.unite,
      quantite: Math.abs(Number(l.quantite) || 0),
      prix_unitaire: Math.abs(Number(l.prix_unitaire) || 0),
      taux_tva: Number(l.taux_tva) || 0,
    }));
  }
  const ht = Math.abs(Number(f.total_ht) || 0);
  const ttc = Math.abs(Number(f.total_ttc) || 0);
  const taux = ht > 0 ? Math.round(((ttc - ht) / ht) * 10000) / 100 : 0;
  return [
    {
      designation: f.objet?.trim() || `Prestation ${f.numero}`,
      unite: "u",
      quantite: 1,
      prix_unitaire: ht,
      taux_tva: taux,
    },
  ];
}

export default function AppFacturationElectronique() {
  usePageMeta(
    "Facturation électronique · ArtiFlow-pro",
    "Préparez et suivez vos factures électroniques : fichiers Factur-X conformes, mentions obligatoires et statut de transmission.",
  );

  const { user, profile, refreshProfile } = useAuth();
  const { loading, error, factures, clients, reload } = useArtisanData();

  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejet, setRejet] = useState<FactureItem | null>(null);
  const [motifRejet, setMotifRejet] = useState("");
  const [rejetBusy, setRejetBusy] = useState(false);
  const [apercuId, setApercuId] = useState<number | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [reglagesBusy, setReglagesBusy] = useState(false);
  const [reglagesNotice, setReglagesNotice] = useState<string | null>(null);
  const [reglagesError, setReglagesError] = useState<string | null>(null);
  // Envoi de la fiche des rejets au comptable : période + liste figées à l'ouverture.
  const [envoiComptable, setEnvoiComptable] = useState<{ moisLabel: string; liste: FactureItem[] } | null>(null);
  const [emailComptable, setEmailComptable] = useState("");
  const [messageComptable, setMessageComptable] = useState("");
  const [envoiComptableBusy, setEnvoiComptableBusy] = useState(false);
  const [envoiComptableError, setEnvoiComptableError] = useState<string | null>(null);

  // L'historique se recharge dès qu'une facture change d'étape.
  const cleHistorique = factures.map((f) => `${f.id}:${f.efacture_statut}`).join("|");
  const { historique } = useHistoriqueEfactures(cleHistorique);

  const controles = useMemo(() => controlerConformite(profile), [profile]);

  const compteurs = useMemo(() => {
    const map: Record<EfStatut, number> = {
      non_preparee: 0,
      preparee: 0,
      transmise: 0,
      recue: 0,
      rejetee: 0,
    };
    factures.forEach((f) => {
      map[f.efacture_statut] += 1;
    });
    return map;
  }, [factures]);

  const emetteur: EfEmetteur = {
    nom: profile?.entreprise ?? "",
    siret: profile?.siret ?? null,
    tva: profile?.tva ?? null,
    email: profile?.email ?? user?.email ?? null,
    telephone: profile?.telephone ?? null,
    dispenseTva: Boolean(profile?.efacture_dispense_tva),
    optionDebits: Boolean(profile?.efacture_option_debits),
    autoliquidation: Boolean(profile?.efacture_autoliquidation),
  };

  const clientDe = (f: FactureItem): EfClient => {
    const c = clients.find((x) => x.id === f.client_id) ?? null;
    return {
      nom: c?.nom ?? f.clientNom ?? "Client",
      siret: c?.siret ?? null,
      adresse: c?.adresse ?? null,
      email: c?.email ?? null,
    };
  };

  const sourceDe = (f: FactureItem): EfFactureSource => ({
    numero: f.numero,
    dateEmission: f.date_emission,
    dateEcheance: f.date_echeance,
    objet: f.objet,
    lignes: lignesDepuisFacture(f),
    estAvoir: f.numero.startsWith("AV"),
  });

  const preparer = async (f: FactureItem) => {
    setActionError(null);
    setNotice(null);
    setBusyId(f.id);
    try {
      const xml = buildFacturXXml(sourceDe(f), emetteur, clientDe(f));
      telechargerXml(nomFichierXml(f.numero), xml);
      await updateEfactureStatut(f.id, "preparee");
      await reload();
      setNotice(
        `Fichier ${nomFichierXml(f.numero)} généré : déposez-le sur votre plateforme de dématérialisation, puis passez la facture en « Transmise ».`,
      );
    } catch {
      setActionError("La génération du fichier électronique a échoué. Réessayez.");
    } finally {
      setBusyId(null);
    }
  };

  const telecharger = (f: FactureItem) => {
    setActionError(null);
    try {
      const xml = buildFacturXXml(sourceDe(f), emetteur, clientDe(f));
      telechargerXml(nomFichierXml(f.numero), xml);
      setNotice(`Fichier ${nomFichierXml(f.numero)} téléchargé.`);
    } catch {
      setActionError("Le téléchargement du fichier électronique a échoué.");
    }
  };

  /**
   * Réunit les XML de toutes les factures d'un mois dans une seule archive ZIP, puis
   * passe en « Prête à transmettre » celles qui n'avaient pas encore leur fichier.
   */
  const telechargerXmlDuMois = async (mois: string, liste: FactureItem[]) => {
    setActionError(null);
    setNotice(null);
    setZipBusy(true);
    try {
      const dejaVu = new Map<string, number>();
      const entries = liste.map((f) => {
        const xml = buildFacturXXml(sourceDe(f), emetteur, clientDe(f));
        let nom = nomFichierXml(f.numero);
        const doublon = dejaVu.get(nom) ?? 0;
        dejaVu.set(nom, doublon + 1);
        if (doublon > 0) nom = nom.replace(/\.xml$/, `-${doublon + 1}.xml`);
        return { name: nom, content: xml, sansBom: true };
      });
      const archive = await downloadZip(`factures-electroniques-${mois}.zip`, entries);
      const aPasserPretes = liste.filter((f) => f.efacture_statut === "non_preparee");
      await Promise.all(
        aPasserPretes.map((f) => updateEfactureStatut(f.id, "preparee").catch(() => undefined)),
      );
      await reload();
      setNotice(
        `Archive générée : ${archive.entries} fichier${archive.entries > 1 ? "s" : ""} XML.${aPasserPretes.length > 0 ? ` ${aPasserPretes.length} facture${aPasserPretes.length > 1 ? "s" : ""} passée${aPasserPretes.length > 1 ? "s" : ""} en « Prête à transmettre ».` : ""} Déposez l'archive sur votre plateforme de dématérialisation, puis marquez les factures « Transmises ».`,
      );
    } catch {
      setActionError("La création de l'archive a échoué. Réessayez.");
    } finally {
      setZipBusy(false);
    }
  };

  const changerStatut = async (f: FactureItem, statut: EfStatut) => {
    setActionError(null);
    setNotice(null);
    setBusyId(f.id);
    try {
      await updateEfactureStatut(f.id, statut);
      await reload();
      setNotice(`${f.numero} : étape mise à jour (${EF_STATUT_META[statut].label}).`);
    } catch {
      setActionError("La mise à jour de l'étape a échoué.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmerRejet = async () => {
    if (!rejet) return;
    setRejetBusy(true);
    setActionError(null);
    try {
      await updateEfactureStatut(rejet.id, "rejetee", motifRejet);
      await reload();
      setRejet(null);
      setMotifRejet("");
      setNotice(`${rejet.numero} marquée comme rejetée : corrigez le motif puis transmettez à nouveau.`);
    } catch {
      setActionError("L'enregistrement du rejet a échoué.");
    } finally {
      setRejetBusy(false);
    }
  };

  /** Fiche « rejets du mois » : liste imprimable ou à envoyer, pour corriger hors écran. */
  const exporterRejetsPdf = (moisLabel: string, liste: FactureItem[]) => {
    setActionError(null);
    setNotice(null);
    try {
      const doc = buildRejetsEfacturePdf({
        moisLabel,
        entreprise: profile?.entreprise ?? null,
        lignes: liste.map((f) => ({
          numero: f.numero,
          client: f.clientNom,
          motif: f.efacture_motif,
          montantTtc: Number(f.total_ttc || 0),
          dateEmission: f.date_emission,
        })),
      });
      const suffixe = moisLabel
        .normalize("NFD")
        .replace(/[^A-Za-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
      savePdf(doc, `rejets-factures-electroniques-${suffixe || "tous-mois"}-${todayISO()}.pdf`);
      setNotice(
        `Fiche des rejets téléchargée (${liste.length} facture${liste.length > 1 ? "s" : ""}) : imprimez-la ou envoyez-la pour traiter les corrections hors écran.`,
      );
    } catch {
      setActionError("La création du PDF des rejets a échoué. Réessayez.");
    }
  };

  // Ouvre la fenêtre d'envoi au comptable depuis le registre (même liste que le PDF des rejets).
  const ouvrirEnvoiComptable = (moisLabel: string, liste: FactureItem[]) => {
    setEnvoiComptableError(null);
    setMessageComptable("");
    setEmailComptable(profile?.comptable_email ?? "");
    setEnvoiComptable({ moisLabel, liste });
  };

  const envoyerFicheAuComptable = async () => {
    if (!envoiComptable) return;
    const to = emailComptable.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      setEnvoiComptableError("Renseignez une adresse email valide pour votre comptable.");
      return;
    }
    setEnvoiComptableBusy(true);
    setEnvoiComptableError(null);
    try {
      const montantTtc = envoiComptable.liste.reduce((somme, f) => somme + Number(f.total_ttc || 0), 0);
      const doc = buildRejetsEfacturePdf({
        moisLabel: envoiComptable.moisLabel,
        entreprise: profile?.entreprise ?? null,
        lignes: envoiComptable.liste.map((f) => ({
          numero: f.numero,
          client: f.clientNom,
          motif: f.efacture_motif,
          montantTtc: Number(f.total_ttc || 0),
          dateEmission: f.date_emission,
        })),
      });
      const suffixe = envoiComptable.moisLabel
        .normalize("NFD")
        .replace(/[^A-Za-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
      await envoyerFicheRejetsComptable({
        to,
        entreprise: profile?.entreprise ?? null,
        moisLabel: envoiComptable.moisLabel,
        nbRejets: envoiComptable.liste.length,
        montantTtc,
        message: messageComptable.trim() || undefined,
        pdfBase64: pdfToBase64(doc),
        filename: `rejets-factures-electroniques-${suffixe || "tous-mois"}-${todayISO()}.pdf`,
      });
      setEnvoiComptable(null);
      setMessageComptable("");
      setNotice(
        `Fiche des rejets envoyée à ${to} (${envoiComptable.liste.length} facture${envoiComptable.liste.length > 1 ? "s" : ""}).`,
      );
    } catch (e) {
      setEnvoiComptableError(e instanceof Error ? e.message : "L'envoi au comptable a échoué. Réessayez.");
    } finally {
      setEnvoiComptableBusy(false);
    }
  };

  const exporterRegistre = () => {
    const lignes = factures.map((f) => ({
      numero: f.numero,
      client: f.clientNom ?? "",
      dateEmission: f.date_emission ? formatShortDate(f.date_emission) : "",
      statut: f.efacture_statut,
      montantTtc: Number(f.total_ttc || 0),
      transmisLe: f.efacture_transmis_le ? formatShortDate(f.efacture_transmis_le.slice(0, 10)) : null,
      motif: f.efacture_motif,
    }));
    downloadCsv(`registre-factures-electroniques-${todayISO()}.csv`, buildRegistreCsv(lignes));
    setNotice("Registre exporté : une ligne par facture, avec son étape et son motif de rejet éventuel.");
  };

  const enregistrerReglages = async (valeurs: {
    optionDebits: boolean;
    autoliquidation: boolean;
    dispenseTva: boolean;
    escompte: string;
    mentionsLibres: string;
    pdp: string;
  }) => {
    if (!user) return;
    setReglagesBusy(true);
    setReglagesNotice(null);
    setReglagesError(null);
    try {
      await updateReglagesEfacture(user.id, valeurs);
      await refreshProfile();
      setReglagesNotice("Mentions enregistrées : elles apparaîtront sur vos prochaines factures.");
    } catch {
      setReglagesError("L'enregistrement des mentions a échoué. Réessayez.");
    } finally {
      setReglagesBusy(false);
    }
  };

  const cartes = [
    { label: "À préparer", valeur: compteurs.non_preparee, ton: "bg-background-100 border-background-200", accent: "text-foreground-950", icone: "ri-file-add-line" },
    { label: "Prêtes à transmettre", valeur: compteurs.preparee, ton: "bg-secondary-50 border-secondary-200", accent: "text-secondary-800", icone: "ri-file-code-line" },
    { label: "Transmises", valeur: compteurs.transmise, ton: "bg-primary-100 border-primary-200", accent: "text-primary-900", icone: "ri-send-plane-line" },
    { label: "Reçues / acceptées", valeur: compteurs.recue, ton: "bg-accent-50 border-accent-200", accent: "text-accent-800", icone: "ri-checkbox-circle-line" },
    { label: "Rejetées", valeur: compteurs.rejetee, ton: "bg-background-100 border-background-200", accent: "text-foreground-950", icone: "ri-error-warning-line" },
  ];

  return (
    <DataState loading={loading} error={error} onRetry={reload}>
      <div className="flex flex-col gap-5 animate-fade-in">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading font-semibold text-lg text-foreground-950">Facturation électronique</h2>
            <p className="text-sm text-foreground-500 mt-0.5 max-w-2xl">
              Générez le fichier structuré de vos factures, imprimez les mentions obligatoires et suivez chaque
              transmission, du dépôt à l'accusé de réception.
            </p>
          </div>
          <Link
            to="/app/factures"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap hover:bg-secondary-200 transition-colors"
          >
            <i className="ri-receipt-line"></i>
            Toutes mes factures
          </Link>
        </div>

        <EncartAide
          ton="primary"
          icone="ri-file-code-line"
          titre="Comment ça marche ?"
          etapes={[
            "Vérifiez les informations de conformité ci-dessous : elles alimentent le fichier électronique.",
            "Cliquez « Préparer le XML » sur une facture : le fichier Factur-X est généré et téléchargé.",
            "Déposez ce fichier sur votre plateforme de dématérialisation (PDP) ou transmettez-le à votre client pro.",
            "Revenez ici pour passer la facture en « Transmise », puis « Reçue » ou « Rejetée » selon la réponse.",
          ]}
          note="Le PDF reste disponible pour vos clients particuliers : les mentions obligatoires (indemnité de recouvrement de 40 €, escompte) y sont désormais ajoutées automatiquement."
        />

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {cartes.map((c) => (
            <div key={c.label} className={`p-4 rounded-lg border ${c.ton}`}>
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${c.accent}`}>
                <i className={c.icone}></i>
                {c.label}
              </span>
              <p className={`mt-1.5 font-heading font-bold text-xl ${c.accent}`}>{c.valeur}</p>
            </div>
          ))}
        </div>

        {(notice || actionError) && (
          <div className="flex flex-col gap-1.5">
            {notice && (
              <p className="text-xs text-accent-700 inline-flex items-start gap-1.5">
                <i className="ri-checkbox-circle-line mt-0.5"></i>
                <span className="break-words">{notice}</span>
              </p>
            )}
            {actionError && (
              <p className="text-xs text-red-600 inline-flex items-start gap-1.5">
                <i className="ri-error-warning-line mt-0.5"></i>
                <span className="break-words">{actionError}</span>
              </p>
            )}
          </div>
        )}

        <TelechargerXmlMoisCard factures={factures} busy={zipBusy} onTelecharger={telechargerXmlDuMois} />

        {profile ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <ConformiteEfactureCard controles={controles} />
            <ReglagesEfactureCard
              key={profile.id}
              defaultOptionDebits={Boolean(profile.efacture_option_debits)}
              defaultAutoliquidation={Boolean(profile.efacture_autoliquidation)}
              defaultDispenseTva={Boolean(profile.efacture_dispense_tva)}
              defaultEscompte={profile.efacture_escompte ?? ""}
              defaultMentionsLibres={profile.efacture_mentions_libres ?? ""}
              defaultPdp={profile.efacture_pdp ?? ""}
              busy={reglagesBusy}
              notice={reglagesNotice}
              error={reglagesError}
              onSave={enregistrerReglages}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 p-5 rounded-lg bg-background-100 border border-background-200 text-xs text-foreground-500">
            <i className="ri-loader-4-line animate-spin"></i>
            Chargement de vos informations d'entreprise…
          </div>
        )}

        <RegistreEfacturesCard
          factures={factures}
          busyId={busyId}
          onPreparer={preparer}
          onTelechargerXml={telecharger}
          onChangerStatut={changerStatut}
          onRejeter={(f) => {
            setMotifRejet("");
            setRejet(f);
          }}
          onApercuPdf={(f) => setApercuId(f.id)}
          onExportCsv={exporterRegistre}
          onPdfRejets={exporterRejetsPdf}
          onEnvoyerRejets={ouvrirEnvoiComptable}
          historique={historique}
        />

        <section className="rounded-lg bg-background-100 border border-background-200 p-5">
          <h3 className="font-heading font-semibold text-sm text-foreground-950">Ce que couvre la réforme</h3>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-lg bg-background-50 border border-background-200">
              <span className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-primary-100 text-primary-800 mb-2">
                <i className="ri-file-code-line"></i>
              </span>
              <p className="text-xs font-semibold text-foreground-900">Un fichier structuré</p>
              <p className="text-[11px] text-foreground-500 mt-1">
                Chaque facture est aussi un document lisible par machine (Factur-X, norme EN 16931), pas seulement un
                PDF.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-background-50 border border-background-200">
              <span className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-secondary-100 text-secondary-800 mb-2">
                <i className="ri-router-line"></i>
              </span>
              <p className="text-xs font-semibold text-foreground-900">Une transmission tracée</p>
              <p className="text-[11px] text-foreground-500 mt-1">
                Les factures passent par une plateforme de dématérialisation, qui conserve le dépôt et l'accusé de
                réception.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-background-50 border border-background-200">
              <span className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-accent-100 text-accent-800 mb-2">
                <i className="ri-calendar-check-line"></i>
              </span>
              <p className="text-xs font-semibold text-foreground-900">Un calendrier progressif</p>
              <p className="text-[11px] text-foreground-500 mt-1">
                La réception concerne toutes les entreprises, puis l'émission s'étend selon la taille. Vérifiez votre
                échéance sur impots.gouv.fr.
              </p>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-foreground-500">
            <i className="ri-information-line mr-1"></i>
            L'application prépare le fichier et suit son statut. L'envoi automatique vers une plateforme agréée (PDP) ou
            Chorus Pro nécessite un compte chez ce prestataire : ses identifiants d'accès sont à ajouter côté serveur
            pour activer la transmission sans manipulation.
          </p>
        </section>
      </div>

      {rejet && (
        <Modal
          title={`Marquer ${rejet.numero} comme rejetée`}
          subtitle="Indiquez le motif renvoyé par la plateforme ou le client, pour le corriger avant de retransmettre."
          onClose={() => setRejet(null)}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="motif-rejet" className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              Motif du rejet
            </label>
            <textarea
              id="motif-rejet"
              value={motifRejet}
              onChange={(e) => setMotifRejet(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Ex. SIRET du client invalide"
              className="w-full box-border px-3 py-2 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 resize-y"
            ></textarea>
            <p className="text-[11px] text-foreground-400">{motifRejet.length}/300 caractères</p>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button
              type="button"
              onClick={() => setRejet(null)}
              className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmerRejet}
              disabled={rejetBusy}
              className="h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60"
            >
              {rejetBusy ? "Enregistrement…" : "Enregistrer le rejet"}
            </button>
          </div>
        </Modal>
      )}

      {envoiComptable && (
        <Modal
          title="Envoyer la fiche des rejets à mon comptable"
          subtitle="La fiche PDF (numéro, client, motif, montant, colonne « Fait ») part en pièce jointe de l'email."
          onClose={() => {
            if (envoiComptableBusy) return;
            setEnvoiComptable(null);
            setEnvoiComptableError(null);
          }}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-background-100 border border-background-200">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-700">
                <i className="ri-error-warning-line text-accent-600"></i>
                {envoiComptable.liste.length} facture{envoiComptable.liste.length > 1 ? "s" : ""} rejetée
                {envoiComptable.liste.length > 1 ? "s" : ""}
              </span>
              <span className="text-[11px] text-foreground-500">·</span>
              <span className="text-[11px] font-semibold text-foreground-900 tabular-nums">
                {formatEuros(envoiComptable.liste.reduce((somme, f) => somme + Number(f.total_ttc || 0), 0))} TTC
              </span>
              <span className="ml-auto inline-flex items-center gap-1 h-6 px-2 rounded-full bg-background-50 border border-background-200 text-[10px] font-semibold text-foreground-600 whitespace-nowrap">
                <i className="ri-calendar-line"></i>
                {envoiComptable.moisLabel}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email-comptable-rejets" className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                Adresse email du comptable
              </label>
              <input
                id="email-comptable-rejets"
                type="email"
                value={emailComptable}
                onChange={(e) => setEmailComptable(e.target.value)}
                placeholder="comptable@cabinet.fr"
                className="w-full h-10 px-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300"
              />
              {profile?.comptable_email ? (
                <p className="text-[11px] text-foreground-400">
                  Adresse enregistrée dans votre profil. Vous pouvez la remplacer pour cet envoi.
                </p>
              ) : (
                <p className="text-[11px] text-foreground-400">
                  Aucune adresse enregistrée : vous pouvez l'ajouter depuis votre profil pour la prochaine fois.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="message-comptable-rejets" className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                Message d'accompagnement (facultatif)
              </label>
              <textarea
                id="message-comptable-rejets"
                value={messageComptable}
                onChange={(e) => setMessageComptable(e.target.value.slice(0, 500))}
                rows={3}
                maxLength={500}
                placeholder="Ex. Bonjour, voici les factures électroniques revenues en erreur ce mois-ci. Pouvez-vous vérifier les SIRET avant retransmission ?"
                className="w-full box-border px-3 py-2 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 resize-y"
              ></textarea>
              <p className="text-[11px] text-foreground-400">{messageComptable.length}/500 caractères</p>
            </div>

            {envoiComptableError && (
              <p className="text-xs text-red-600 inline-flex items-start gap-1.5">
                <i className="ri-error-warning-line mt-0.5"></i>
                <span className="break-words">{envoiComptableError}</span>
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <button
              type="button"
              onClick={() => {
                setEnvoiComptable(null);
                setEnvoiComptableError(null);
              }}
              disabled={envoiComptableBusy}
              className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={envoyerFicheAuComptable}
              disabled={envoiComptableBusy}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-accent-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-60"
            >
              {envoiComptableBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-send-line"></i>}
              {envoiComptableBusy ? "Envoi en cours…" : "Envoyer la fiche"}
            </button>
          </div>
        </Modal>
      )}

      {apercuId !== null && (
        <ApercuPdfModal
          title="Aperçu de la facture"
          subtitle="Le document reprend vos mentions obligatoires et la mention de facture électronique."
          filename={`facture-${apercuId}.pdf`}
          docBuilder={async () => {
            const result = await buildFacturePdfById(apercuId);
            if (!result) throw new Error("Facture introuvable");
            return result.doc;
          }}
          note="Aucun fichier n'est enregistré tant que vous n'avez pas cliqué sur « Télécharger le PDF »."
          onClose={() => setApercuId(null)}
        />
      )}
    </DataState>
  );
}