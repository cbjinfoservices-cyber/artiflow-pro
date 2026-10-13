import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ClientItem, DevisItem } from "@/hooks/useArtisanData";
import { createDevisModeleFromDevis, fetchDevisLignes, type LigneInput } from "@/lib/artisanApi";
import { appendLignesToDevis } from "@/lib/devisLignes";
import { designationDansBibliotheque, type LigneAInserer } from "@/lib/bibliothequeLignes";
import { useAuth } from "@/hooks/useAuth";
import { useEnregistrerLigneBibliotheque } from "@/hooks/useEnregistrerLigneBibliotheque";
import { useCategoriesEnregistrement } from "@/hooks/useCategoriesEnregistrement";
import { useLignesBibliotheque } from "@/hooks/useLignesBibliotheque";
import EnregistrerLigneMenu from "@/pages/app/components/EnregistrerLigneMenu";
import DejaBibliothequeBadge from "@/pages/app/components/DejaBibliothequeBadge";
import { supabase } from "@/lib/supabase";
import { devisStatusTone } from "@/lib/statuts";
import { formatEuros } from "@/lib/format";
import { formatShortDate } from "@/lib/dates";
import { buildDocumentPdf, savePdf } from "@/lib/pdf";
import {
  buildSignUrl,
  ensureDevisSignToken,
  fetchDevisSignature,
  signDevisInPerson,
  type DevisSignatureInfo,
} from "@/lib/signature";
import Modal from "@/pages/app/components/Modal";
import Infobulle from "@/components/base/Infobulle";
import StatutBadge from "@/pages/app/components/StatutBadge";
import SignatureModal from "@/pages/app/devis/components/SignatureModal";
import LignesBibliothequeModal from "@/pages/app/devis/components/LignesBibliothequeModal";

const EMPTY_SIGNATURE: DevisSignatureInfo = { signature_image: null, signataire_nom: null, signed_at: null };

export default function DevisDetailModal({
  devis,
  client,
  clients,
  onBroadcast,
  onClose,
  onChanged,
}: {
  devis: DevisItem;
  client: ClientItem | null;
  clients?: ClientItem[];
  onBroadcast?: () => void;
  onClose: () => void;
  onChanged?: () => void | Promise<void>;
}) {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [lignes, setLignes] = useState<LigneInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [signature, setSignature] = useState<DevisSignatureInfo>(EMPTY_SIGNATURE);
  const [signOpen, setSignOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [modelNom, setModelNom] = useState(devis.objet?.trim() || devis.numero);
  const [savingModel, setSavingModel] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [biblioOpen, setBiblioOpen] = useState(false);
  const { enregistrer, enregistrerPlusieurs } = useEnregistrerLigneBibliotheque();
  const categoriesEnregistrement = useCategoriesEnregistrement(user?.id ?? null);
  const { lignes: biblioLignes, reload: reloadBiblio } = useLignesBibliotheque(user?.id ?? null);

  const loadSignature = useCallback(async () => {
    try {
      setSignature(await fetchDevisSignature(devis.id));
    } catch {
      /* silencieux */
    }
  }, [devis.id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([fetchDevisLignes(devis.id), fetchDevisSignature(devis.id)])
      .then(([rows, info]) => {
        if (!active) return;
        setLignes(rows);
        setSignature(info);
      })
      .catch(() => {
        if (active) setLignes([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [devis.id]);

  const handleDownload = async () => {
    const doc = await buildDocumentPdf({
      type: "devis",
      numero: devis.numero,
      dateLabel: formatShortDate(devis.created_at),
      statut: devis.statut,
      objet: devis.objet ?? "",
      emetteur: {
        entreprise: profile?.entreprise ?? "",
        metier: profile?.metier ?? "",
        telephone: profile?.telephone ?? "",
        email: profile?.email ?? user?.email ?? "",
        logo: profile?.logo_url ?? null,
        siret: profile?.siret ?? null,
        tva: profile?.tva ?? null,
        assurance: profile?.assurance ?? null,
      },
      client: client
        ? { nom: client.nom, adresse: client.adresse, telephone: client.telephone, email: client.email }
        : devis.clientNom
          ? { nom: devis.clientNom }
          : null,
      lignes,
      totalHT: devis.total_ht,
      totalTTC: devis.total_ttc,
      signature: signature.signed_at
        ? {
            nom: signature.signataire_nom ?? client?.nom ?? "Client",
            dateLabel: formatShortDate(signature.signed_at),
            image: signature.signature_image,
          }
        : null,
    });
    savePdf(doc, `Devis-${devis.numero}.pdf`);
  };

  const handleCopyLink = async () => {
    setNotice(null);
    try {
      const token = await ensureDevisSignToken(devis.id);
      await navigator.clipboard.writeText(buildSignUrl(token));
      setNotice({ tone: "ok", text: "Lien de signature copié. Envoyez-le à votre client par email ou SMS." });
    } catch {
      setNotice({ tone: "error", text: "Impossible de copier le lien pour l'instant. Réessayez." });
    }
  };

  const handleSignInPerson = async (nom: string, dataUrl: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await signDevisInPerson(devis.id, dataUrl, nom);
      await loadSignature();
      setSignOpen(false);
      setNotice({ tone: "ok", text: "Devis signé. Bien joué !" });
      await onChanged?.();
    } catch {
      setNotice({ tone: "error", text: "La signature n'a pas pu être enregistrée. Réessayez." });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAsModel = async () => {
    if (!user) return;
    const nom = modelNom.trim();
    if (!nom) {
      setNotice({ tone: "error", text: "Donnez un nom à votre modèle." });
      return;
    }
    setSavingModel(true);
    setNotice(null);
    try {
      await createDevisModeleFromDevis(user.id, devis.id, nom);
      setModelOpen(false);
      setNotice({ tone: "ok", text: `Modèle « ${nom} » enregistré. Réutilisez-le en un clic depuis le tableau de bord.` });
    } catch {
      setNotice({ tone: "error", text: "L'enregistrement du modèle a échoué. Réessayez." });
    } finally {
      setSavingModel(false);
    }
  };

  // Complète un devis existant avec des lignes de la bibliothèque (ajout + recalcul des totaux).
  const handleCompleterBiblio = async (inserees: LigneAInserer[]) => {
    setBiblioOpen(false);
    setNotice(null);
    try {
      const payload: LigneInput[] = inserees.map((l) => ({
        designation: l.designation,
        unite: l.unite || "u",
        quantite: 1,
        prix_unitaire: l.prix_unitaire,
        taux_tva: l.taux_tva,
      }));
      await appendLignesToDevis(devis.id, payload);
      setLignes(await fetchDevisLignes(devis.id));
      setNotice({ tone: "ok", text: `${inserees.length} ligne(s) ajoutée(s) au devis.` });
      await onChanged?.();
    } catch {
      setNotice({ tone: "error", text: "L'ajout des lignes au devis a échoué. Réessayez." });
    }
  };

  // Enregistre une ligne du devis dans la bibliothèque, dans la catégorie choisie.
  const handleEnregistrerLigne = async (index: number, categorie: string) => {
    const ligne = lignes[index];
    if (!ligne) return;
    if (!ligne.designation.trim()) {
      setNotice({ tone: "error", text: "Cette ligne n'a pas de désignation à enregistrer." });
      return;
    }
    setNotice(null);
    try {
      await enregistrer(
        {
          designation: ligne.designation,
          unite: ligne.unite,
          prix_unitaire: ligne.prix_unitaire,
          taux_tva: ligne.taux_tva,
        },
        categorie,
      );
      await reloadBiblio();
      setNotice({ tone: "ok", text: `« ${ligne.designation.trim()} » enregistrée dans « ${categorie} ».` });
    } catch {
      setNotice({ tone: "error", text: "L'enregistrement dans la bibliothèque a échoué." });
    }
  };

  // Enregistre d'un coup toutes les lignes du devis (en ignorant celles déjà présentes).
  const handleEnregistrerTout = async (categorie: string) => {
    const aEnregistrer = lignes
      .filter((l) => l.designation.trim() && !designationDansBibliotheque(biblioLignes, l.designation))
      .map((l) => ({
        designation: l.designation,
        unite: l.unite,
        prix_unitaire: l.prix_unitaire,
        taux_tva: l.taux_tva,
      }));
    if (aEnregistrer.length === 0) {
      setNotice({ tone: "ok", text: "Toutes les lignes de ce devis sont déjà dans votre bibliothèque." });
      return;
    }
    setNotice(null);
    try {
      const n = await enregistrerPlusieurs(aEnregistrer, categorie);
      await reloadBiblio();
      setNotice({ tone: "ok", text: `${n} ligne(s) enregistrée(s) dans « ${categorie} ».` });
    } catch {
      setNotice({ tone: "error", text: "L'enregistrement des lignes a échoué. Réessayez." });
    }
  };

  const handleSendEmail = async () => {
    setNotice(null);
    if (!client?.email) {
      setNotice({ tone: "error", text: "Ce client n'a pas d'adresse email. Ajoutez-la dans sa fiche pour envoyer le devis." });
      return;
    }
    setSendingEmail(true);
    try {
      const token = await ensureDevisSignToken(devis.id);
      const signUrl = buildSignUrl(token);
      const { data, error } = await supabase.functions.invoke("send-devis-email", {
        body: { devisId: devis.id, signUrl },
      });
      if (error) throw new Error(error.message);
      const payloadData = data as { ok?: boolean; error?: string } | null;
      if (!payloadData?.ok) throw new Error(payloadData?.error || "L'envoi a échoué.");
      setNotice({ tone: "ok", text: `Devis envoyé à ${client.email}.` });
      await onChanged?.();
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "L'envoi de l'email a échoué." });
    } finally {
      setSendingEmail(false);
    }
  };

  const signed = Boolean(signature.signed_at);

  return (
    <>
      <Modal
        title={devis.numero}
        subtitle={`${devis.clientNom ?? "Sans client"} · créé le ${formatShortDate(devis.created_at)}`}
        onClose={onClose}
        wide
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
            >
              Fermer
            </button>
            {devis.client_id && (
              <button
                type="button"
                onClick={() => navigate(`/app/clients?client=${devis.client_id}`)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold cursor-pointer hover:border-primary-300 whitespace-nowrap transition-colors"
                title="Ouvrir la fiche complète du client"
              >
                <i className="ri-user-line"></i>
                Voir le client
              </button>
            )}
            {!signed && (
              <>
                <Infobulle
                  contenu="Copier un lien de signature à envoyer à votre client par email ou SMS : il signe en ligne, sans impression."
                  position="haut"
                  largeur={260}
                >
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold cursor-pointer hover:bg-secondary-200 whitespace-nowrap transition-colors"
                  >
                    <i className="ri-link"></i>
                    Lien client
                  </button>
                </Infobulle>
                <Infobulle
                  contenu="Faire signer ce devis : sur place (vous passez l'appareil au client) ou en ligne avec le lien à copier."
                  position="haut"
                  largeur={270}
                >
                  <button
                    type="button"
                    onClick={() => setSignOpen(true)}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-secondary-600 whitespace-nowrap transition-colors"
                  >
                    <i className="ri-quill-pen-line"></i>
                    Faire signer
                  </button>
                </Infobulle>
              </>
            )}
            {onBroadcast && clients && clients.length > 0 && (
              <Infobulle
                contenu="Créer une copie de ce devis pour plusieurs clients et l'envoyer à chacun en une seule fois."
                position="haut"
                largeur={260}
              >
                <button
                  type="button"
                  onClick={onBroadcast}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold cursor-pointer hover:border-accent-300 whitespace-nowrap transition-colors"
                >
                  <i className="ri-mail-add-line"></i>
                  Envoyer à plusieurs
                </button>
              </Infobulle>
            )}
            <Infobulle
              contenu="Ajouter des lignes toutes prêtes depuis votre bibliothèque de prestations (main-d'œuvre, fournitures…)."
              position="haut"
              largeur={260}
            >
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  setBiblioOpen(true);
                }}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-accent-100 text-accent-800 text-sm font-semibold cursor-pointer hover:bg-accent-200 whitespace-nowrap transition-colors"
                title="Ajouter des lignes de la bibliothèque à ce devis"
              >
                <i className="ri-list-check-2"></i>
                Compléter
              </button>
            </Infobulle>
            <Infobulle
              contenu="Garder ce devis comme modèle réutilisable : vous le réutiliserez en un clic pour un autre chantier."
              position="haut"
              largeur={260}
            >
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  setModelNom(devis.objet?.trim() || devis.numero);
                  setModelOpen(true);
                }}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold cursor-pointer hover:border-primary-300 whitespace-nowrap transition-colors"
                title="Enregistrer ce devis comme modèle réutilisable"
              >
                <i className="ri-bookmark-line"></i>
                Enregistrer comme modèle
              </button>
            </Infobulle>
            <Infobulle
              contenu="Envoyer le devis à votre client par email, avec un lien pour qu'il signe en ligne."
              position="haut"
              largeur={260}
            >
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={sendingEmail || loading}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-accent-500 text-background-50 dark:text-foreground-950 text-sm font-semibold cursor-pointer hover:bg-accent-600 whitespace-nowrap transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sendingEmail ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-send-line"></i>}
                Envoyer par email
              </button>
            </Infobulle>
            <Infobulle
              contenu="Télécharger le devis en PDF (prêt à imprimer), avec la signature du client s'il a signé."
              position="haut"
              largeur={250}
            >
              <button
                type="button"
                onClick={handleDownload}
                disabled={loading}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <i className="ri-file-download-line"></i>
                Télécharger en PDF
              </button>
            </Infobulle>
          </>
        }
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-900">{devis.objet ?? "Sans objet"}</p>
            {devis.modeleNom && (
              <span
                className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-semibold max-w-full"
                title={`Devis généré depuis le modèle « ${devis.modeleNom} »`}
              >
                <i className="ri-bookmark-3-line"></i>
                <span className="truncate">Issu du modèle « {devis.modeleNom} »</span>
              </span>
            )}
          </div>
          <StatutBadge label={devis.statut} tone={devisStatusTone(devis.statut)} />
        </div>

        {!loading && lignes.length > 0 && (
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-500">Lignes du devis</p>
            <EnregistrerLigneMenu
              categories={categoriesEnregistrement}
              onSave={handleEnregistrerTout}
              label="Tout enregistrer"
            />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <i className="ri-loader-4-line animate-spin text-xl text-primary-600"></i>
          </div>
        ) : lignes.length === 0 ? (
          <p className="py-8 text-center text-sm text-foreground-500">Aucune ligne détaillée pour ce devis.</p>
        ) : (
          <div className="rounded-lg border border-background-200 overflow-hidden">
            <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide bg-background-200/50">
              <span className="col-span-6">Désignation</span>
              <span className="col-span-2 text-right">Qté</span>
              <span className="col-span-2 text-right">P.U.</span>
              <span className="col-span-2 text-right">Total</span>
            </div>
            {lignes.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 border-t border-background-200 text-sm">
                <span className="col-span-12 sm:col-span-6 flex items-start justify-between gap-2">
                  <span className="min-w-0 flex flex-col items-start gap-1.5">
                    <span className="text-foreground-800">{l.designation}</span>
                    {designationDansBibliotheque(biblioLignes, l.designation) && <DejaBibliothequeBadge />}
                  </span>
                  <EnregistrerLigneMenu
                    categories={categoriesEnregistrement}
                    onSave={(categorie) => handleEnregistrerLigne(i, categorie)}
                    compact
                  />
                </span>
                <span className="col-span-4 sm:col-span-2 sm:text-right text-foreground-600">
                  {l.quantite} {l.unite}
                </span>
                <span className="col-span-4 sm:col-span-2 sm:text-right text-foreground-600">{formatEuros(l.prix_unitaire)}</span>
                <span className="col-span-4 sm:col-span-2 sm:text-right font-semibold text-foreground-950">
                  {formatEuros(l.quantite * l.prix_unitaire)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 p-3 rounded-md bg-accent-50 border border-accent-200">
          <span className="text-xs font-medium text-foreground-700">Total du devis</span>
          <div className="text-right">
            <p className="text-sm font-bold text-foreground-950">{formatEuros(devis.total_ht)} HT</p>
            <p className="text-[11px] text-foreground-500">{formatEuros(devis.total_ttc)} TTC</p>
          </div>
        </div>

        {/* Signature */}
        {signed ? (
          <div className="mt-4 p-4 rounded-lg bg-accent-50 border border-accent-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
                <i className="ri-checkbox-circle-line"></i>
              </span>
              <p className="text-sm font-semibold text-foreground-950">Devis signé</p>
            </div>
            {signature.signature_image && (
              <div className="rounded-md bg-background-50 border border-background-200 p-2 mb-2">
                <img
                  src={signature.signature_image}
                  alt="Signature du client"
                  className="h-16 object-contain"
                />
              </div>
            )}
            <p className="text-xs text-foreground-600">
              Signé par <strong className="text-foreground-900">{signature.signataire_nom ?? client?.nom ?? "le client"}</strong> le{" "}
              {formatShortDate(signature.signed_at)}
            </p>
          </div>
        ) : (
          <div className="mt-4 p-4 rounded-lg bg-background-100 border border-background-200 flex flex-col gap-2.5">
            <p className="text-sm font-semibold text-foreground-900 flex items-center gap-2">
              <i className="ri-quill-pen-line text-primary-600"></i>
              Faire signer ce devis
            </p>
            <p className="text-xs text-foreground-500">
              Deux options : signez sur place (vous passez l'appareil au client) ou copiez le lien à envoyer pour une signature en
              ligne.
            </p>
            <div className="flex flex-wrap gap-2 mt-1">
              <Infobulle
                contenu="Vous passez l'appareil au client : il signe directement sur l'écran avec le doigt ou le stylet."
                position="haut"
                largeur={260}
              >
                <button
                  type="button"
                  onClick={() => setSignOpen(true)}
                  className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold cursor-pointer hover:bg-secondary-600 whitespace-nowrap transition-colors"
                >
                  <i className="ri-quill-pen-line"></i> Faire signer sur place
                </button>
              </Infobulle>
              <Infobulle
                contenu="Copier le lien de signature : envoyez-le au client, il signe en ligne quand il veut."
                position="haut"
                largeur={260}
              >
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold cursor-pointer hover:border-primary-300 whitespace-nowrap transition-colors"
                >
                  <i className="ri-file-copy-line"></i> Copier le lien client
                </button>
              </Infobulle>
            </div>
          </div>
        )}

        {notice && (
          <p
            className={`mt-3 text-xs flex items-center gap-1.5 ${notice.tone === "ok" ? "text-accent-700" : "text-red-600"}`}
          >
            <i className={notice.tone === "ok" ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
            {notice.text}
          </p>
        )}

        <p className="mt-3 text-[11px] text-foreground-400 flex items-center gap-1.5">
          <i className="ri-information-line"></i>
          Le PDF reprend votre logo, vos mentions légales et la signature du client si le devis est signé.
        </p>
      </Modal>

      {signOpen && (
        <SignatureModal
          titre={`${devis.numero} · ${devis.clientNom ?? "Sans client"}`}
          busy={busy}
          onClose={() => setSignOpen(false)}
          onSubmit={handleSignInPerson}
        />
      )}

      {modelOpen && (
        <Modal
          title="Enregistrer comme modèle"
          subtitle="Ce devis deviendra un modèle réutilisable en un clic depuis votre tableau de bord."
          onClose={() => setModelOpen(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setModelOpen(false)}
                className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveAsModel}
                disabled={savingModel}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap disabled:opacity-60"
              >
                {savingModel ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-bookmark-line"></i>}
                Enregistrer le modèle
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground-700">Nom du modèle</span>
              <input
                value={modelNom}
                onChange={(e) => setModelNom(e.target.value)}
                placeholder="Rénovation salle de bain"
                className="h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400"
              />
            </label>
            <p className="text-xs text-foreground-500 flex items-center gap-1.5">
              <i className="ri-information-line"></i>
              {lignes.length} ligne{lignes.length > 1 ? "s" : ""} et l'objet « {devis.objet ?? "sans objet"} » seront copiés dans le modèle.
            </p>
          </div>
        </Modal>
      )}

      {biblioOpen && (
        <LignesBibliothequeModal
          userId={user?.id ?? null}
          onClose={() => setBiblioOpen(false)}
          onInsert={handleCompleterBiblio}
          designationsUtilisees={lignes.map((l) => l.designation)}
        />
      )}
    </>
  );
}