import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { usePersistedState } from "@/hooks/usePersistedState";
import { CLE_ONGLET_PROFIL, ONGLETS_PROFIL, VALIDER_ONGLET_PROFIL, type OngletProfil } from "@/lib/profilPrefs";
import RecapReglagesProfil, { type CibleProfil } from "@/pages/app/profil/components/RecapReglagesProfil";
import SuiviAbonnement from "@/pages/app/profil/components/SuiviAbonnement";
import { useAuth } from "@/hooks/useAuth";
import { useRecapQuotidien } from "@/hooks/useRecapQuotidien";
import { METIERS, metierLabel } from "@/lib/metiers";
import { STATUTS_JURIDIQUES, TAILLES_ENTREPRISE, statutJuridiqueLabel, tailleEntrepriseLabel } from "@/lib/entreprise";
import { ACCENT_DEFAUT, ACCENTS_DOCUMENTS } from "@/lib/documentStyle";
import { CANAUX, RECAP_DEVIS_SEUIL_OPTIONS, RECAP_RELANCE_FACTURE_SEUIL_OPTIONS, RELANCE_FACTURE_DELAI_OPTIONS } from "@/lib/relances";
import { updateComptableOverrideEmailDefaut, updateComptableOverrideAdresses } from "@/lib/artisanApi";
import HistoriqueRelancesFactures from "@/pages/app/components/HistoriqueRelancesFactures";
import ApercuAutoRelanceModal from "@/pages/app/profil/components/ApercuAutoRelanceModal";
import ApercuDocument from "@/pages/app/profil/components/ApercuDocument";
import ApercuEmail from "@/pages/app/profil/components/ApercuEmail";
import CarteSecuriteMotDePasse from "@/components/feature/CarteSecuriteMotDePasse";
import SupprimerCompteCard from "@/pages/app/profil/components/SupprimerCompteCard";
import MesDroitsRgpdCard from "@/pages/app/profil/components/MesDroitsRgpdCard";
import HistoriqueSuppressionsCard from "@/pages/app/profil/components/HistoriqueSuppressionsCard";
import GuidePremiereVisite from "@/components/base/GuidePremiereVisite";
import { guidePremiereVisiteVu, marquerGuidePremiereVisiteVu } from "@/lib/guidePremiereVisite";

/** Heures proposées pour l'envoi du récapitulatif (06:00 → 22:00, heure de Paris). */
const RECAP_HEURES = Array.from({ length: 17 }, (_, i) => i + 6);

const CANAL_ICONS: Record<string, string> = {
  Email: "ri-mail-line",
  SMS: "ri-message-2-line",
  WhatsApp: "ri-whatsapp-line",
};

function formatHeure(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

export default function AppProfil() {
  usePageMeta("Mon profil · ArtiFlow-pro", "Modifiez les informations de votre entreprise artisan.");
  const { user, profile, profileLoading, updateProfile, refreshProfile } = useAuth();
  const {
    actif,
    canaux,
    heure,
    devisSeuil,
    relanceFactureAuto,
    relanceFactureSeuil,
    relanceFactureDelai,
    rappelActif,
    rappelHeure,
    toggleActif,
    toggleCanal,
    changeHeure,
    changeDevisSeuil,
    toggleRelanceFactureAuto,
    changeRelanceFactureSeuil,
    changeRelanceFactureDelai,
    toggleRappelActif,
    changeRappelHeure,
  } = useRecapQuotidien();

  const [entreprise, setEntreprise] = useState("");
  const [metier, setMetier] = useState("");
  const [statutJuridique, setStatutJuridique] = useState("");
  const [tailleEntreprise, setTailleEntreprise] = useState("");
  const [telephone, setTelephone] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [siret, setSiret] = useState("");
  const [tva, setTva] = useState("");
  const [assurance, setAssurance] = useState("");
  const [penalitesRetard, setPenalitesRetard] = useState("");
  // Apparence personnalisable des documents (devis & factures) : couleur, logo, coordonnées de paiement.
  const [docCouleur, setDocCouleur] = useState(ACCENT_DEFAUT);
  const [docAfficherLogo, setDocAfficherLogo] = useState(true);
  const [docPaiement, setDocPaiement] = useState("");
  const [docPiedPage, setDocPiedPage] = useState("");
  // Modèle de mise en page des documents : standard (colonnes séparées) ou compact (P.U. + Total regroupés).
  const [docModele, setDocModele] = useState<"standard" | "compact">("standard");
  const [emailSujetDevis, setEmailSujetDevis] = useState("");
  const [emailCorpsDevis, setEmailCorpsDevis] = useState("");
  const [emailSujetFacture, setEmailSujetFacture] = useState("");
  const [emailCorpsFacture, setEmailCorpsFacture] = useState("");
  const [emailSujetRelance, setEmailSujetRelance] = useState("");
  const [emailCorpsRelance, setEmailCorpsRelance] = useState("");
  const [emailSujetRecontact, setEmailSujetRecontact] = useState("");
  const [emailCorpsRecontact, setEmailCorpsRecontact] = useState("");
  const [emailSujetRecontactAuto, setEmailSujetRecontactAuto] = useState("");
  const [emailCorpsRecontactAuto, setEmailCorpsRecontactAuto] = useState("");
  const [emailSujetAlerteArtisan, setEmailSujetAlerteArtisan] = useState("");
  const [emailCorpsAlerteArtisan, setEmailCorpsAlerteArtisan] = useState("");
  const [emailTab, setEmailTab] = useState<"devis" | "facture" | "relance" | "recontact">("devis");
  // Aperçu de l'email d'auto-relance des oubliés (aucun envoi).
  const [apercuAutoRelanceOpen, setApercuAutoRelanceOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = usePersistedState<OngletProfil>(CLE_ONGLET_PROFIL, VALIDER_ONGLET_PROFIL);
  // Adresse ponctuelle par défaut (ex. comptable remplaçant habituel), pré-remplie au 1er envoi.
  const [overrideDefaut, setOverrideDefaut] = useState("");
  // Liste des adresses ponctuelles nommées (ex. « Comptable remplaçant A », « Cabinet externe »).
  const [overrideAdresses, setOverrideAdresses] = useState<{ nom: string; email: string }[]>([]);
  const [nouveauNom, setNouveauNom] = useState("");
  const [nouveauEmail, setNouveauEmail] = useState("");
  const [overrideDefautBusy, setOverrideDefautBusy] = useState(false);
  const [overrideDefautNotice, setOverrideDefautNotice] = useState<string | null>(null);
  const [overrideDefautError, setOverrideDefautError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Ancre de section à amener à l'écran après une navigation depuis le récapitulatif de l'Historique.
  const [ancreCible, setAncreCible] = useState<string | null>(null);

  // Ouverture d'un onglet via l'URL (ex. retour de paiement ou ancien lien « Mon abonnement »
  // redirigé) : on ouvre l'onglet demandé puis on nettoie le paramètre.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const cible = searchParams.get("onglet");
    if (!cible) return;
    if ((ONGLETS_PROFIL as readonly string[]).includes(cible)) {
      setTab(cible as OngletProfil);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("onglet");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, setTab]);

  // Guide de première visite : ouvert au premier passage sur la page Profil, puis mémorisé une fois fermé.
  const [guideVisible, setGuideVisible] = useState(() => !guidePremiereVisiteVu("profil"));
  const fermerGuide = () => {
    marquerGuidePremiereVisiteVu("profil");
    setGuideVisible(false);
  };

  // Après une navigation depuis le récapitulatif, on amène la section visée sous les yeux
  // de l'artisan (l'onglet venant de changer, on attend le rendu puis on fait défiler).
  useEffect(() => {
    if (!ancreCible) return;
    const cible = document.getElementById(ancreCible);
    if (cible) cible.scrollIntoView({ behavior: "smooth", block: "start" });
    setAncreCible(null);
  }, [ancreCible, tab]);

  useEffect(() => {
    if (profile) {
      setEntreprise(profile.entreprise ?? "");
      setMetier(profile.metier ?? "");
      setStatutJuridique(profile.statut_juridique ?? "");
      setTailleEntreprise(profile.taille_entreprise ?? "");
      setTelephone(profile.telephone ?? "");
      setLogoUrl(profile.logo_url ?? null);
      setSiret(profile.siret ?? "");
      setTva(profile.tva ?? "");
      setAssurance(profile.assurance ?? "");
      setPenalitesRetard(profile.penalites_retard ?? "");
      setDocCouleur(profile.doc_couleur ?? ACCENT_DEFAUT);
      setDocAfficherLogo(profile.doc_afficher_logo !== false);
      setDocPaiement(profile.doc_paiement ?? "");
      setDocPiedPage(profile.doc_pied_page ?? "");
      setDocModele(profile.doc_modele === "compact" ? "compact" : "standard");
      setEmailSujetDevis(profile.email_sujet_devis ?? "");
      setEmailCorpsDevis(profile.email_corps_devis ?? "");
      setEmailSujetFacture(profile.email_sujet_facture ?? "");
      setEmailCorpsFacture(profile.email_corps_facture ?? "");
      setEmailSujetRelance(profile.email_sujet_relance ?? "");
      setEmailCorpsRelance(profile.email_corps_relance ?? "");
      setEmailSujetRecontact(profile.email_sujet_recontact ?? "");
      setEmailCorpsRecontact(profile.email_corps_recontact ?? "");
      setEmailSujetRecontactAuto(profile.email_sujet_recontact_auto ?? "");
      setEmailCorpsRecontactAuto(profile.email_corps_recontact_auto ?? "");
      setEmailSujetAlerteArtisan(profile.email_sujet_alerte_artisan ?? "");
      setEmailCorpsAlerteArtisan(profile.email_corps_alerte_artisan ?? "");
      setOverrideDefaut(profile.comptable_override_email_defaut ?? "");
      setOverrideAdresses(Array.isArray(profile.comptable_override_adresses) ? profile.comptable_override_adresses : []);
    }
  }, [profile]);

  // Onglets « Entreprise » et « Emails » : on signale par une pastille qu'un champ a été
  // modifié sans être encore enregistré (comparaison avec le profil enregistré côté Backend).
  const entrepriseDirty = useMemo(() => {
    if (!profile) return false;
    return (
      (profile.entreprise ?? "") !== entreprise.trim() ||
      (profile.metier ?? "") !== metier ||
      (profile.statut_juridique ?? "") !== statutJuridique ||
      (profile.taille_entreprise ?? "") !== tailleEntreprise ||
      (profile.telephone ?? "") !== telephone.trim() ||
      (profile.logo_url ?? null) !== logoUrl ||
      (profile.siret ?? "") !== siret.trim() ||
      (profile.tva ?? "") !== tva.trim() ||
      (profile.assurance ?? "") !== assurance.trim() ||
      (profile.penalites_retard ?? "") !== penalitesRetard.trim() ||
      (profile.doc_couleur ?? ACCENT_DEFAUT) !== docCouleur ||
      (profile.doc_afficher_logo !== false) !== docAfficherLogo ||
      (profile.doc_paiement ?? "") !== docPaiement.trim() ||
      (profile.doc_pied_page ?? "") !== docPiedPage.trim() ||
      (profile.doc_modele === "compact" ? "compact" : "standard") !== docModele
    );
  }, [profile, entreprise, metier, statutJuridique, tailleEntreprise, telephone, logoUrl, siret, tva, assurance, penalitesRetard, docCouleur, docAfficherLogo, docPaiement, docPiedPage, docModele]);

  const emailsDirty = useMemo(() => {
    if (!profile) return false;
    return (
      (profile.email_sujet_devis ?? "") !== emailSujetDevis.trim() ||
      (profile.email_corps_devis ?? "") !== emailCorpsDevis.trim() ||
      (profile.email_sujet_facture ?? "") !== emailSujetFacture.trim() ||
      (profile.email_corps_facture ?? "") !== emailCorpsFacture.trim() ||
      (profile.email_sujet_relance ?? "") !== emailSujetRelance.trim() ||
      (profile.email_corps_relance ?? "") !== emailCorpsRelance.trim() ||
      (profile.email_sujet_recontact ?? "") !== emailSujetRecontact.trim() ||
      (profile.email_corps_recontact ?? "") !== emailCorpsRecontact.trim() ||
      (profile.email_sujet_recontact_auto ?? "") !== emailSujetRecontactAuto.trim() ||
      (profile.email_corps_recontact_auto ?? "") !== emailCorpsRecontactAuto.trim() ||
      (profile.email_sujet_alerte_artisan ?? "") !== emailSujetAlerteArtisan.trim() ||
      (profile.email_corps_alerte_artisan ?? "") !== emailCorpsAlerteArtisan.trim()
    );
  }, [
    profile,
    emailSujetDevis,
    emailCorpsDevis,
    emailSujetFacture,
    emailCorpsFacture,
    emailSujetRelance,
    emailCorpsRelance,
    emailSujetRecontact,
    emailCorpsRecontact,
    emailSujetRecontactAuto,
    emailCorpsRecontactAuto,
    emailSujetAlerteArtisan,
    emailCorpsAlerteArtisan,
  ]);

  // L'onglet ouvert contient-il une saisie qui n'est pas encore enregistrée ?
  const modifsNonEnregistrees = (tab === "entreprise" && entrepriseDirty) || (tab === "emails" && emailsDirty);

  const email = profile?.email ?? user?.email ?? "—";
  const initials =
    (entreprise.trim() || email)
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "AF";

  const inputCls =
    "h-11 px-3 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400 transition-colors";

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choisissez une image (PNG ou JPG).");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 400;
        const scale = Math.min(max / img.width, max / img.height, 1);
        const w = Math.max(Math.round(img.width * scale), 1);
        const h = Math.max(Math.round(img.height * scale), 1);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        setLogoUrl(canvas.toDataURL("image/png"));
        setSaved(false);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setError(null);
    setSaved(false);
    if (!entreprise.trim()) {
      setError("Le nom de l'entreprise est obligatoire.");
      return;
    }
    setBusy(true);
    const result = await updateProfile({
      entreprise: entreprise.trim(),
      metier,
      statut_juridique: statutJuridique,
      taille_entreprise: tailleEntreprise,
      telephone: telephone.trim(),
      logo_url: logoUrl,
      siret: siret.trim(),
      tva: tva.trim(),
      assurance: assurance.trim(),
      penalites_retard: penalitesRetard.trim(),
      doc_couleur: docCouleur,
      doc_afficher_logo: docAfficherLogo,
      doc_paiement: docPaiement.trim(),
      doc_pied_page: docPiedPage.trim(),
      doc_modele: docModele,
      email_sujet_devis: emailSujetDevis.trim(),
      email_corps_devis: emailCorpsDevis.trim(),
      email_sujet_facture: emailSujetFacture.trim(),
      email_corps_facture: emailCorpsFacture.trim(),
      email_sujet_relance: emailSujetRelance.trim(),
      email_corps_relance: emailCorpsRelance.trim(),
      email_sujet_recontact: emailSujetRecontact.trim(),
      email_corps_recontact: emailCorpsRecontact.trim(),
      email_sujet_recontact_auto: emailSujetRecontactAuto.trim(),
      email_corps_recontact_auto: emailCorpsRecontactAuto.trim(),
      email_sujet_alerte_artisan: emailSujetAlerteArtisan.trim(),
      email_corps_alerte_artisan: emailCorpsAlerteArtisan.trim(),
    });
    setBusy(false);
    if (result.error) {
      setError("L'enregistrement a échoué. Réessayez dans un instant.");
      return;
    }
    setSaved(true);
  };

  // Réinitialise entreprise & mentions légales depuis le profil enregistré (annule les saisies non sauvegardées).
  const resetEntreprise = () => {
    if (!profile) return;
    setEntreprise(profile.entreprise ?? "");
    setMetier(profile.metier ?? "");
    setStatutJuridique(profile.statut_juridique ?? "");
    setTailleEntreprise(profile.taille_entreprise ?? "");
    setTelephone(profile.telephone ?? "");
    setLogoUrl(profile.logo_url ?? null);
    setSiret(profile.siret ?? "");
    setTva(profile.tva ?? "");
    setAssurance(profile.assurance ?? "");
    setPenalitesRetard(profile.penalites_retard ?? "");
    setDocCouleur(profile.doc_couleur ?? ACCENT_DEFAUT);
    setDocAfficherLogo(profile.doc_afficher_logo !== false);
    setDocPaiement(profile.doc_paiement ?? "");
    setDocPiedPage(profile.doc_pied_page ?? "");
    setDocModele(profile.doc_modele === "compact" ? "compact" : "standard");
    setError(null);
    setSaved(false);
  };

  // Réinitialise la personnalisation des emails depuis le profil enregistré.
  const resetEmails = () => {
    if (!profile) return;
    setEmailSujetDevis(profile.email_sujet_devis ?? "");
    setEmailCorpsDevis(profile.email_corps_devis ?? "");
    setEmailSujetFacture(profile.email_sujet_facture ?? "");
    setEmailCorpsFacture(profile.email_corps_facture ?? "");
    setEmailSujetRelance(profile.email_sujet_relance ?? "");
    setEmailCorpsRelance(profile.email_corps_relance ?? "");
    setEmailSujetRecontact(profile.email_sujet_recontact ?? "");
    setEmailCorpsRecontact(profile.email_corps_recontact ?? "");
    setEmailSujetRecontactAuto(profile.email_sujet_recontact_auto ?? "");
    setEmailCorpsRecontactAuto(profile.email_corps_recontact_auto ?? "");
    setEmailSujetAlerteArtisan(profile.email_sujet_alerte_artisan ?? "");
    setEmailCorpsAlerteArtisan(profile.email_corps_alerte_artisan ?? "");
    setError(null);
    setSaved(false);
  };

  // Annule d'un clic les modifications non sauvegardées de l'onglet ouvert (Entreprise ou Emails).
  const handleReset = () => {
    if (tab === "entreprise") resetEntreprise();
    else if (tab === "emails") resetEmails();
  };

  // Navigation depuis le récapitulatif de l'Historique : ouvre l'onglet visé, le bon
  // sous-onglet d'emails le cas échéant, et amène la section concernée à l'écran.
  const naviguerProfil = (cible: CibleProfil) => {
    setTab(cible.onglet);
    if (cible.onglet === "emails" && cible.emailTab) setEmailTab(cible.emailTab);
    setAncreCible(cible.ancre ?? null);
  };

  // Ajoute une adresse ponctuelle nommée à la liste locale (enregistrée via « Enregistrer les adresses »).
  const handleAddOverride = () => {
    const nom = nouveauNom.trim();
    const email = nouveauEmail.trim();
    setOverrideDefautNotice(null);
    setOverrideDefautError(null);
    if (!nom || !email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setOverrideDefautError("Saisissez une adresse email valide (ex. comptable-remplacant@cabinet.fr).");
      return;
    }
    if (overrideAdresses.some((a) => a.email.toLowerCase() === email.toLowerCase())) {
      setOverrideDefautError("Cette adresse est déjà enregistrée.");
      return;
    }
    setOverrideAdresses((prev) => [...prev, { nom, email }]);
    // Proposée par défaut si aucune ne l'est encore, pour que le premier renvoi soit pré-rempli.
    if (!overrideDefaut.trim()) setOverrideDefaut(email);
    setNouveauNom("");
    setNouveauEmail("");
  };

  // Retire une adresse de la liste locale.
  const handleRemoveOverride = (index: number) => {
    setOverrideAdresses((prev) => prev.filter((_, i) => i !== index));
    setOverrideDefautNotice(null);
    setOverrideDefautError(null);
  };

  // Enregistre la liste des adresses ponctuelles nommées ainsi que celle proposée par défaut.
  const handleSaveOverrideList = async () => {
    if (!user) return;
    setOverrideDefautNotice(null);
    setOverrideDefautError(null);
    setOverrideDefautBusy(true);
    try {
      await updateComptableOverrideAdresses(user.id, overrideAdresses);
      const defautValide = overrideAdresses.find(
        (a) => a.email.trim().toLowerCase() === overrideDefaut.trim().toLowerCase(),
      );
      await updateComptableOverrideEmailDefaut(user.id, defautValide?.email ?? "");
      await refreshProfile();
      setOverrideDefautNotice(
        overrideAdresses.length
          ? "Vos adresses ponctuelles nommées ont été enregistrées."
          : "Liste d'adresses vidée.",
      );
    } catch {
      setOverrideDefautError("L'enregistrement a échoué. Réessayez.");
    } finally {
      setOverrideDefautBusy(false);
    }
  };

  if (profileLoading && !profile) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <i className="ri-loader-4-line animate-spin text-2xl text-primary-600"></i>
          <p className="text-sm text-foreground-500">Chargement de votre profil…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in max-w-4xl">
      {/* Carte d'identité */}
      <div className="flex items-center gap-4 p-5 rounded-lg bg-background-100 border border-background-200">
        {logoUrl ? (
          <span className="w-16 h-16 shrink-0 rounded-lg bg-background-50 border border-background-200 flex items-center justify-center overflow-hidden">
            <img src={logoUrl} alt="Logo de l'entreprise" className="w-full h-full object-contain" />
          </span>
        ) : (
          <span className="w-16 h-16 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 font-heading font-bold text-xl">
            {initials}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-heading font-bold text-xl text-foreground-950 truncate">{entreprise || "Mon entreprise"}</h2>
          <p className="text-sm text-foreground-500 truncate">
            {metierLabel(metier) || "Métier non renseigné"} · {email}
          </p>
        </div>
      </div>

      {guideVisible && (
        <GuidePremiereVisite
          titre="Bienvenue : réglez votre espace à votre main"
          sousTitre="Votre profil est rangé en 5 onglets pour aller droit au but. Tout se modifie à tout moment : vous ne pouvez rien casser."
          etapes={[
            {
              icone: "ri-building-line",
              titre: "Renseignez votre entreprise",
              texte:
                "Nom, logo, SIRET, TVA, assurance : ces informations apparaissent automatiquement sur vos devis et factures.",
            },
            {
              icone: "ri-mail-settings-line",
              titre: "Personnalisez vos emails",
              texte:
                "Adaptez l'objet et le texte des emails envoyés à vos clients : devis, factures, relances ou récapitulatifs.",
            },
            {
              icone: "ri-mail-check-line",
              titre: "Réglez les automatismes",
              texte:
                "Activez votre récapitulatif quotidien, vos relances automatiques et ajustez leurs seuils en un clic.",
            },
            {
              icone: "ri-save-line",
              titre: "Enregistrez",
              texte:
                "Un seul bouton en bas de page mémorise tous vos réglages d'un coup. Les interrupteurs, eux, s'enregistrent tout seuls.",
            },
          ]}
          note="Ce guide ne s'affiche qu'une seule fois. Vous pouvez le revoir à tout moment avec « Revoir le guide du profil »."
          onFermer={fermerGuide}
        />
      )}

      {!guideVisible && (
        <button
          type="button"
          onClick={() => setGuideVisible(true)}
          className="self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background-100 border border-background-200 text-foreground-600 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 hover:text-accent-700 transition-colors"
        >
          <i className="ri-question-line"></i>
          Revoir le guide du profil
        </button>
      )}

      {/* Onglets : une seule section affichée à la fois pour éviter le défilement */}
      <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
        {([
          { key: "entreprise", label: "Entreprise", icone: "ri-building-line" },
          { key: "automatismes", label: "Automatismes", icone: "ri-mail-check-line" },
          { key: "emails", label: "Emails", icone: "ri-mail-settings-line" },
          { key: "abonnement", label: "Abonnement", icone: "ri-vip-crown-line" },
          { key: "securite", label: "Sécurité", icone: "ri-shield-keyhole-line" },
          { key: "historique", label: "Historique", icone: "ri-history-line" },
        ] as const).map((t) => {
          const dirty = (t.key === "entreprise" && entrepriseDirty) || (t.key === "emails" && emailsDirty);
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                tab === t.key ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              <i className={t.icone}></i>
              {t.label}
              {dirty && (
                <span
                  title="Modifications non enregistrées"
                  aria-label="Modifications non enregistrées"
                  className={`w-1.5 h-1.5 rounded-full ${tab === t.key ? "bg-background-50" : "bg-accent-500"}`}
                ></span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "historique" && (
        <>
          <RecapReglagesProfil profile={profile} onNaviguer={naviguerProfil} />
          <HistoriqueRelancesFactures userId={user?.id ?? null} />
        </>
      )}

      {tab === "abonnement" && <SuiviAbonnement />}

      {tab === "entreprise" && (
        <>
      {/* Formulaire entreprise */}
      <div id="profil-infos-entreprise" className="p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-9 h-9 flex items-center justify-center rounded-md bg-primary-100 text-primary-700">
            <i className="ri-user-settings-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-semibold text-base text-foreground-950">Informations de l'entreprise</h3>
            <p className="text-xs text-foreground-500">Ces informations apparaissent sur vos devis et factures.</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 p-3 rounded-md bg-background-50 border border-background-200">
            <span className="w-16 h-16 shrink-0 rounded-md bg-background-100 border border-background-200 flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Aperçu du logo" className="w-full h-full object-contain" />
              ) : (
                <i className="ri-image-line text-2xl text-foreground-300"></i>
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground-900">Logo de l'entreprise</p>
              <p className="text-[11px] text-foreground-500">PNG ou JPG, affiché en haut de vos devis et factures.</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold cursor-pointer hover:bg-secondary-200 whitespace-nowrap transition-colors"
                >
                  <i className="ri-upload-2-line"></i>
                  {logoUrl ? "Changer le logo" : "Ajouter un logo"}
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoUrl(null);
                      setSaved(false);
                    }}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium text-foreground-500 hover:bg-background-200 cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-delete-bin-line"></i> Retirer
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Nom de l'entreprise</span>
            <input
              value={entreprise}
              onChange={(e) => setEntreprise(e.target.value)}
              placeholder="Plomberie Benali"
              className={inputCls}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground-700">Métier</span>
              <select value={metier} onChange={(e) => setMetier(e.target.value)} className={`${inputCls} cursor-pointer`}>
                <option value="">Sélectionnez votre métier</option>
                {METIERS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground-700">Téléphone</span>
              <input
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="06 12 34 56 78"
                className={inputCls}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground-700">Statut juridique</span>
              <select
                value={statutJuridique}
                onChange={(e) => setStatutJuridique(e.target.value)}
                className={`${inputCls} cursor-pointer`}
              >
                <option value="">Sélectionnez votre statut juridique</option>
                {STATUTS_JURIDIQUES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground-700">Taille de l'entreprise</span>
              <select
                value={tailleEntreprise}
                onChange={(e) => setTailleEntreprise(e.target.value)}
                className={`${inputCls} cursor-pointer`}
              >
                <option value="">Combien de personnes travaillent avec vous ?</option>
                {TAILLES_ENTREPRISE.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Adresse email</span>
            <input value={email} readOnly className={`${inputCls} opacity-70 cursor-not-allowed`} />
            <span className="text-[11px] text-foreground-400">L'email de connexion ne se modifie pas ici.</span>
          </label>
        </div>
      </div>

      {/* Formulaire mentions légales */}
      <div id="profil-mentions-legales" className="p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-9 h-9 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
            <i className="ri-file-shield-2-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-semibold text-base text-foreground-950">Mentions légales</h3>
            <p className="text-xs text-foreground-500">Reprises en bas de vos devis et factures PDF.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Numéro SIRET</span>
            <input value={siret} onChange={(e) => setSiret(e.target.value)} placeholder="123 456 789 00012" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">N° TVA intracommunautaire</span>
            <input value={tva} onChange={(e) => setTva(e.target.value)} placeholder="FR 12 345678901" className={inputCls} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 mt-4">
          <span className="text-xs font-medium text-foreground-700">Assurance (RC pro / décennale)</span>
          <input
            value={assurance}
            onChange={(e) => setAssurance(e.target.value)}
            placeholder="Décennale AXA – police n° 123456, garantie France"
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5 mt-4">
          <span className="text-xs font-medium text-foreground-700">Pénalités de retard (obligatoire sur facture)</span>
          <input
            value={penalitesRetard}
            onChange={(e) => setPenalitesRetard(e.target.value)}
            placeholder="Ex. : 3 fois le taux d'intérêt légal, indemnité forfaitaire de recouvrement de 40 €"
            className={inputCls}
          />
          <span className="text-[11px] text-foreground-400">
            Affichée automatiquement en bas de vos factures PDF, comme le SIRET et le n° de TVA.
          </span>
        </label>
      </div>

      {/* Apparence des documents */}
      <div id="profil-apparence" className="p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-9 h-9 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
            <i className="ri-palette-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-semibold text-base text-foreground-950">Apparence des documents</h3>
            <p className="text-xs text-foreground-500">
              Personnalisez vos devis et factures PDF : couleur, logo et coordonnées de paiement.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="p-3 rounded-md bg-background-50 border border-background-200">
            <p className="text-sm font-medium text-foreground-900">Couleur d'accent</p>
            <p className="text-[11px] text-foreground-500 mt-0.5">Utilisée sur le bloc des totaux et les coordonnées de paiement.</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {ACCENTS_DOCUMENTS.map((c) => {
                const on = docCouleur.toLowerCase() === c.value.toLowerCase();
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => {
                      setDocCouleur(c.value);
                      setSaved(false);
                    }}
                    aria-pressed={on}
                    title={c.label}
                    className={`inline-flex items-center gap-2 h-9 pl-1.5 pr-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors border ${
                      on ? "border-primary-400 bg-background-100" : "border-background-200 bg-background-50 hover:bg-background-100"
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-full border border-black/10"
                      style={{ backgroundColor: c.value }}
                      aria-hidden="true"
                    ></span>
                    {c.label}
                  </button>
                );
              })}
              <label className="inline-flex items-center gap-2 h-9 pl-1.5 pr-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer border border-background-200 bg-background-50 hover:bg-background-100">
                <input
                  type="color"
                  value={docCouleur}
                  onChange={(e) => {
                    setDocCouleur(e.target.value);
                    setSaved(false);
                  }}
                  className="w-6 h-6 rounded-full border border-black/10 cursor-pointer bg-transparent p-0"
                  aria-label="Couleur personnalisée"
                />
                Personnalisée
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-background-50 border border-background-200">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground-900">Afficher le logo sur les documents</p>
              <p className="text-[11px] text-foreground-500 mt-0.5">
                Le logo enregistré apparaît en haut de vos devis et factures PDF.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={docAfficherLogo}
              onClick={() => {
                setDocAfficherLogo((v) => !v);
                setSaved(false);
              }}
              className={`inline-flex items-center gap-2 h-8 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors shrink-0 ${
                docAfficherLogo ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-500 border border-background-200"
              }`}
            >
              <i className="ri-toggle-line text-base"></i>
              {docAfficherLogo ? "Affiché" : "Masqué"}
            </button>
          </div>

          {/* Modèle de mise en page des documents : standard ou compact. */}
          <div className="flex flex-col gap-2 p-3 rounded-md bg-background-50 border border-background-200">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground-900">Modèle de document</p>
              <p className="text-[11px] text-foreground-500 mt-0.5">
                Choisissez la densité du tableau de vos devis et factures.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {([
                {
                  key: "standard" as const,
                  label: "Standard",
                  icone: "ri-table-line",
                  desc: "Une colonne par information : Désignation · Qté · P.U. HT · TVA · Total HT.",
                },
                {
                  key: "compact" as const,
                  label: "Compact",
                  icone: "ri-layout-4-line",
                  desc: "P.U. HT et Total HT regroupés dans une seule colonne : idéal quand les lignes sont courtes.",
                },
              ]).map((m) => {
                const on = docModele === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setDocModele(m.key);
                      setSaved(false);
                    }}
                    className={`flex-1 text-left p-3 rounded-md border cursor-pointer transition-colors ${
                      on ? "border-primary-400 bg-background-100" : "border-background-200 bg-background-50 hover:bg-background-100"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`w-7 h-7 flex items-center justify-center rounded-md ${
                          on ? "bg-primary-500 text-background-50" : "bg-background-100 text-foreground-500"
                        }`}
                      >
                        <i className={m.icone}></i>
                      </span>
                      <span className="text-sm font-semibold text-foreground-950">{m.label}</span>
                      {on && <i className="ri-checkbox-circle-line text-primary-600 ml-auto"></i>}
                    </span>
                    <span className="block text-[11px] text-foreground-500 mt-1.5">{m.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Coordonnées de paiement (affichées sur vos factures)</span>
            <textarea
              value={docPaiement}
              onChange={(e) => {
                setDocPaiement(e.target.value);
                setSaved(false);
              }}
              rows={3}
              placeholder={"Ex. : Règlement par virement\nIBAN : FR76 1234 5678 9012 3456 7890 123\nBIC : ABCDFRPP\nPaiement à 30 jours."}
              className="px-3 py-2 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400 resize-none"
            />
            <span className="text-[11px] text-foreground-400">
              Reprises dans un bloc « Coordonnées de paiement » en bas de chaque facture. Laissez vide pour ne rien afficher.
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Message de pied de page (devis & factures)</span>
            <textarea
              value={docPiedPage}
              onChange={(e) => {
                setDocPiedPage(e.target.value);
                setSaved(false);
              }}
              rows={2}
              placeholder="Ex. : Merci de votre confiance · Devis gratuit sous 48 h · Retrouvez-nous sur artiflow-pro.com"
              className="px-3 py-2 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400 resize-none"
            />
            <span className="text-[11px] text-foreground-400">
              Un texte libre affiché en bas de <strong className="font-medium">tous</strong> vos documents (devis et factures), hors coordonnées de paiement. Laissez vide pour ne rien afficher.
            </span>
          </label>

          {/* Aperçu en direct : reflète l'apparence choisie sans générer de PDF. */}
          <div className="pt-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
                <i className="ri-eye-line text-sm"></i>
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground-900">Aperçu en direct</p>
                <p className="text-[11px] text-foreground-500">Voici le rendu de vos factures avec les réglages ci-dessus.</p>
              </div>
            </div>
            <ApercuDocument
              entreprise={entreprise}
              couleur={docCouleur}
              afficherLogo={docAfficherLogo}
              logoUrl={logoUrl}
              paiement={docPaiement}
              piedPage={docPiedPage}
              metier={metierLabel(metier)}
              modele={docModele}
            />
          </div>
        </div>
      </div>
        </>
      )}

      {tab === "securite" && (
        <>
          <CarteSecuriteMotDePasse />
          <MesDroitsRgpdCard />
          <SupprimerCompteCard />
          <HistoriqueSuppressionsCard />
        </>
      )}

      {tab === "automatismes" && (
        <>
      {/* Récapitulatif & relances automatiques */}
      <div id="profil-automatismes" className="p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-9 h-9 flex items-center justify-center rounded-md bg-primary-100 text-primary-700">
            <i className="ri-mail-check-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-semibold text-base text-foreground-950">
              Récapitulatif & relances automatiques
            </h3>
            <p className="text-xs text-foreground-500">
              Ces réglages sont enregistrés automatiquement dans votre profil et respectés par les tâches planifiées.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Interrupteur d'activation du récap */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-background-50 border border-background-200">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground-900">Récapitulatif quotidien par email</p>
              <p className="text-[11px] text-foreground-500 mt-0.5">
                Un seul email par jour : reprogrammations, échecs, factures en retard et devis sans réponse.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={actif}
              onClick={toggleActif}
              title={actif ? "Couper le récapitulatif quotidien" : "Activer le récapitulatif quotidien"}
              className={`inline-flex items-center gap-2 h-8 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors shrink-0 ${
                actif
                  ? "bg-primary-500 text-background-50"
                  : "bg-background-100 text-foreground-500 border border-background-200"
              }`}
            >
              <i className={actif ? "ri-toggle-line text-base" : "ri-toggle-line text-base opacity-60"}></i>
              {actif ? "Activé" : "Coupé"}
            </button>
          </div>

          {/* Heure d'envoi */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-md bg-background-50 border border-background-200">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground-900">Heure d'envoi du récapitulatif</p>
              <p className="text-[11px] text-foreground-500 mt-0.5">Choisissez votre créneau (heure de Paris).</p>
            </div>
            <label
              className={`inline-flex items-center gap-2 h-9 px-3 rounded-md border text-sm font-medium shrink-0 ${
                actif ? "bg-background-100 border-background-200 text-foreground-800" : "bg-background-100 border-background-200 text-foreground-400"
              }`}
            >
              <i className="ri-time-line"></i>
              <select
                value={heure}
                onChange={(e) => changeHeure(Number(e.target.value))}
                disabled={!actif}
                aria-label="Heure d'envoi du récapitulatif"
                className="bg-transparent text-sm font-semibold text-foreground-900 outline-none cursor-pointer disabled:cursor-not-allowed"
              >
                {RECAP_HEURES.map((h) => (
                  <option key={h} value={h}>
                    {formatHeure(h)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Canaux inclus */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-md bg-background-50 border border-background-200">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground-900">Canaux inclus dans le récapitulatif</p>
              <p className="text-[11px] text-foreground-500 mt-0.5">Choisissez les canaux recensés dans l'email.</p>
            </div>
            <div className="flex gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200 shrink-0">
              {CANAUX.map((canal) => {
                const on = canaux.includes(canal);
                return (
                  <button
                    key={canal}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => toggleCanal(canal)}
                    disabled={!actif}
                    title={on ? `Retirer ${canal} du récapitulatif` : `Inclure ${canal} dans le récapitulatif`}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      on ? "bg-secondary-500 text-background-50" : "text-foreground-500 hover:bg-background-200"
                    }`}
                  >
                    <i className={CANAL_ICONS[canal] ?? "ri-send-plane-line"}></i>
                    {canal}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seuil des devis sans réponse */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-md bg-background-50 border border-background-200">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground-900">Devis « sans réponse » après</p>
              <p className="text-[11px] text-foreground-500 mt-0.5">
                Seuls les devis restés sans décision depuis au moins N jours apparaissent dans le récapitulatif.
              </p>
            </div>
            <div className="flex gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200 shrink-0">
              {RECAP_DEVIS_SEUIL_OPTIONS.map((jours) => {
                const on = devisSeuil === jours;
                return (
                  <button
                    key={jours}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => changeDevisSeuil(jours)}
                    disabled={!actif}
                    title={`N'inclure que les devis sans réponse depuis plus de ${jours} jours`}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      on ? "bg-accent-500 text-background-50" : "text-foreground-500 hover:bg-background-200"
                    }`}
                  >
                    {jours} j
                  </button>
                );
              })}
            </div>
          </div>

          {/* Relance automatique des factures critiques depuis le récap */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-md bg-background-50 border border-background-200">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground-900">Relancer les factures critiques sans clic</p>
              <p className="text-[11px] text-foreground-500 mt-0.5">
                À chaque récapitulatif quotidien, un rappel est envoyé automatiquement aux clients des factures non
                payées les plus anciennes.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                role="switch"
                aria-checked={relanceFactureAuto}
                onClick={toggleRelanceFactureAuto}
                disabled={!actif}
                title={
                  relanceFactureAuto
                    ? "Couper la relance automatique des factures"
                    : "Activer la relance automatique des factures"
                }
                className={`inline-flex items-center gap-2 h-8 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  relanceFactureAuto
                    ? "bg-primary-500 text-background-50"
                    : "bg-background-100 text-foreground-500 border border-background-200"
                }`}
              >
                <i className={relanceFactureAuto ? "ri-toggle-line text-base" : "ri-toggle-line text-base opacity-60"}></i>
                {relanceFactureAuto ? "Activée" : "Coupée"}
              </button>
              <div className="flex gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200">
                {RECAP_RELANCE_FACTURE_SEUIL_OPTIONS.map((jours) => {
                  const on = relanceFactureSeuil === jours;
                  return (
                    <button
                      key={jours}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => changeRelanceFactureSeuil(jours)}
                      disabled={!actif || !relanceFactureAuto}
                      title={`Relancer les factures en retard de plus de ${jours} jours`}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        on ? "bg-accent-500 text-background-50" : "text-foreground-500 hover:bg-background-200"
                      }`}
                    >
                      +{jours} j
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Délai anti-doublon entre deux rappels d'une même facture */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-md bg-background-50 border border-background-200">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground-900">Ne pas relancer deux fois trop vite</p>
              <p className="text-[11px] text-foreground-500 mt-0.5">
                Délai minimum avant de pouvoir rappeler une même facture déjà relancée (relance manuelle et
                automatique confondues).
              </p>
            </div>
            <div className="flex gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200 shrink-0">
              {RELANCE_FACTURE_DELAI_OPTIONS.map((jours) => {
                const on = relanceFactureDelai === jours;
                return (
                  <button
                    key={jours}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => changeRelanceFactureDelai(jours)}
                    title={`Ne pas rappeler une facture déjà relancée depuis moins de ${jours} jours`}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      on ? "bg-secondary-500 text-background-50" : "text-foreground-500 hover:bg-background-200"
                    }`}
                  >
                    {jours} j
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rappel la veille d'une relance programmée */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-md bg-background-50 border border-background-200">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground-900">Rappel la veille d'une relance programmée</p>
              <p className="text-[11px] text-foreground-500 mt-0.5">
                Un email vous prévient la veille pour revoir le message (ou annuler) avant l'envoi automatique.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                role="switch"
                aria-checked={rappelActif}
                onClick={toggleRappelActif}
                title={rappelActif ? "Couper le rappel de la veille" : "Activer le rappel de la veille"}
                className={`inline-flex items-center gap-2 h-8 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  rappelActif
                    ? "bg-primary-500 text-background-50"
                    : "bg-background-100 text-foreground-500 border border-background-200"
                }`}
              >
                <i className="ri-toggle-line text-base"></i>
                {rappelActif ? "Activé" : "Coupé"}
              </button>
              <label
                className={`inline-flex items-center gap-2 h-9 px-3 rounded-md border text-sm font-medium ${
                  rappelActif
                    ? "bg-background-100 border-background-200 text-foreground-800"
                    : "bg-background-100 border-background-200 text-foreground-400"
                }`}
              >
                <i className="ri-time-line"></i>
                <select
                  value={rappelHeure}
                  onChange={(e) => changeRappelHeure(Number(e.target.value))}
                  disabled={!rappelActif}
                  aria-label="Heure d'envoi du rappel de la veille"
                  className="bg-transparent text-sm font-semibold text-foreground-900 outline-none cursor-pointer disabled:cursor-not-allowed"
                >
                  {RECAP_HEURES.map((h) => (
                    <option key={h} value={h}>
                      {formatHeure(h)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Adresses & envois comptables */}
      <div id="profil-adresses-comptables" className="p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-9 h-9 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
            <i className="ri-bookmark-3-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-semibold text-base text-foreground-950">Adresses & envois comptables</h3>
            <p className="text-xs text-foreground-500">
              Enregistrez plusieurs adresses ponctuelles nommées (ex. « Comptable remplaçant A », « Cabinet externe »).
              Vous pourrez choisir laquelle proposer au moment d'un renvoi.
            </p>
          </div>
        </div>

        {overrideAdresses.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {overrideAdresses.map((a, i) => {
              const estDefaut = overrideDefaut.trim().toLowerCase() === a.email.trim().toLowerCase();
              return (
                <li
                  key={`${a.email}-${i}`}
                  className="flex flex-wrap items-center gap-3 p-3 rounded-md bg-background-50 border border-background-200"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={estDefaut}
                    onClick={() => {
                      setOverrideDefaut(a.email);
                      setOverrideDefautNotice(null);
                      setOverrideDefautError(null);
                    }}
                    title="Proposer cette adresse par défaut au moment d'un renvoi"
                    className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-full cursor-pointer transition-colors ${
                      estDefaut
                        ? "bg-secondary-500 text-background-50"
                        : "bg-background-100 border border-background-300 text-foreground-400 hover:border-secondary-300"
                    }`}
                  >
                    <i className={estDefaut ? "ri-check-line" : "ri-bookmark-line"}></i>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground-900 truncate">{a.nom}</p>
                    <p className="text-[11px] text-foreground-500 truncate">{a.email}</p>
                  </div>
                  {estDefaut && (
                    <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-bold whitespace-nowrap">
                      <i className="ri-star-line"></i>
                      Proposée par défaut
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveOverride(i)}
                    title="Retirer cette adresse"
                    className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-500 cursor-pointer hover:bg-background-200 transition-colors"
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-foreground-500">Aucune adresse enregistrée pour l'instant.</p>
        )}

        {/* Ajout d'une adresse nommée */}
        <div className="mt-4 p-3 rounded-md bg-background-50 border border-background-200">
          <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide mb-2">Ajouter une adresse</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={nouveauNom}
              onChange={(e) => setNouveauNom(e.target.value)}
              placeholder="Libellé (ex. Cabinet externe)"
              className={`${inputCls} sm:max-w-[240px]`}
            />
            <input
              type="email"
              value={nouveauEmail}
              onChange={(e) => setNouveauEmail(e.target.value)}
              placeholder="adresse@cabinet.fr"
              className={`${inputCls} flex-1`}
            />
            <button
              type="button"
              onClick={handleAddOverride}
              disabled={!nouveauNom.trim() || !nouveauEmail.trim()}
              className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-add-line"></i>
              Ajouter
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSaveOverrideList}
            disabled={overrideDefautBusy}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {overrideDefautBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
            Enregistrer les adresses
          </button>
          <span className="text-[11px] text-foreground-400 inline-flex items-center gap-1.5">
            <i className="ri-information-line"></i>
            Votre comptable habituel n'est jamais modifié par ces renvois.
          </span>
          {overrideDefautError && (
            <p className="text-[11px] text-red-600 flex items-center gap-1.5">
              <i className="ri-error-warning-line"></i>
              {overrideDefautError}
            </p>
          )}
          {overrideDefautNotice && !overrideDefautError && (
            <p className="text-[11px] text-accent-700 flex items-center gap-1.5">
              <i className="ri-checkbox-circle-line"></i>
              {overrideDefautNotice}
            </p>
          )}
        </div>
      </div>
        </>
      )}

      {tab === "emails" && (
        <>
      {/* Personnalisation des emails */}
      <div id="profil-emails" className="p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-9 h-9 flex items-center justify-center rounded-md bg-primary-100 text-primary-700">
            <i className="ri-mail-settings-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-semibold text-base text-foreground-950">Personnalisation des emails</h3>
            <p className="text-xs text-foreground-500">L'objet et le texte des emails envoyés à vos clients.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit mb-4">
          {([
            { key: "devis", label: "Devis" },
            { key: "facture", label: "Factures" },
            { key: "relance", label: "Relances" },
            { key: "recontact", label: "Récap recontact" },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setEmailTab(t.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                emailTab === t.key ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          {emailTab === "devis" && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground-700">Objet de l'email du devis</span>
                <input
                  value={emailSujetDevis}
                  onChange={(e) => setEmailSujetDevis(e.target.value)}
                  placeholder="Votre devis {{numero}} · {{objet}}"
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground-700">Texte de l'email du devis</span>
                <textarea
                  value={emailCorpsDevis}
                  onChange={(e) => setEmailCorpsDevis(e.target.value)}
                  rows={5}
                  placeholder={"Bonjour {{client}},\n\nVoici votre devis {{numero}} d'un montant de {{montant}}. Vous pouvez le signer en ligne via le lien ci-dessous."}
                  className="px-3 py-2 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400 resize-none"
                />
              </label>
            </>
          )}

          {emailTab === "facture" && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground-700">Objet de l'email de facture</span>
                <input
                  value={emailSujetFacture}
                  onChange={(e) => setEmailSujetFacture(e.target.value)}
                  placeholder="Votre facture {{numero}}"
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground-700">Texte de l'email de facture</span>
                <textarea
                  value={emailCorpsFacture}
                  onChange={(e) => setEmailCorpsFacture(e.target.value)}
                  rows={5}
                  placeholder={"Bonjour {{client}},\n\nVeuillez trouver ci-joint votre facture {{numero}} d'un montant de {{montant}}, à régler avant le {{echeance}}."}
                  className="px-3 py-2 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400 resize-none"
                />
              </label>
            </>
          )}

          {emailTab === "relance" && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground-700">Objet de l'email de relance</span>
                <input
                  value={emailSujetRelance}
                  onChange={(e) => setEmailSujetRelance(e.target.value)}
                  placeholder="Un mot de {{entreprise}}"
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground-700">Texte de l'email de relance client</span>
                <textarea
                  value={emailCorpsRelance}
                  onChange={(e) => setEmailCorpsRelance(e.target.value)}
                  rows={5}
                  placeholder={"Bonjour {{client}},\n\nJe me permets de vous recontacter au sujet de notre dossier. N'hésitez pas à revenir vers moi dès que vous le souhaitez."}
                  className="px-3 py-2 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400 resize-none"
                />
                <span className="text-[11px] text-foreground-400">
                  Ce message est utilisé pour les relances client envoyées en un clic depuis le tableau de bord, ainsi que pour
                  les relances programmées à une date choisie.
                </span>
              </label>
            </>
          )}

          {emailTab === "recontact" && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground-700">Objet de l'email de récap hebdomadaire</span>
                <input
                  value={emailSujetRecontact}
                  onChange={(e) => setEmailSujetRecontact(e.target.value)}
                  placeholder="{{nb}} comptes très volatils à recontacter · ArtiFlow-pro"
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground-700">Texte de l'email de récap hebdomadaire</span>
                <textarea
                  value={emailCorpsRecontact}
                  onChange={(e) => setEmailCorpsRecontact(e.target.value)}
                  rows={5}
                  placeholder={"Bonjour {{entreprise}},\n\nVoici la liste des comptes très volatils à recontacter depuis plus de {{delai}} jours. C'est le bon moment pour reprendre contact."}
                  className="px-3 py-2 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400 resize-none"
                />
                <span className="text-[11px] text-foreground-400">
                  Ce message part chaque semaine (si le « Récap hebdo » est activé dans la page Abonnements) avec le tableau
                  des comptes concernés ajouté juste en dessous.
                </span>
              </label>

              <div className="h-px bg-background-200 my-1" />
              <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                Auto-relance des oubliés
              </p>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground-700">Objet de l'email d'auto-relance</span>
                <input
                  value={emailSujetRecontactAuto}
                  onChange={(e) => setEmailSujetRecontactAuto(e.target.value)}
                  placeholder="Votre abonnement ArtiFlow-pro — un point sur votre formule"
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground-700">Texte de l'email d'auto-relance</span>
                <textarea
                  value={emailCorpsRecontactAuto}
                  onChange={(e) => setEmailCorpsRecontactAuto(e.target.value)}
                  rows={5}
                  placeholder={"Bonjour,\n\nNous suivons votre abonnement ArtiFlow-pro et souhaitons nous assurer que l'offre en cours correspond toujours à votre activité.\n\nSeriez-vous disponible pour un échange rapide cette semaine ?"}
                  className="px-3 py-2 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400 resize-none"
                />
                <span className="text-[11px] text-foreground-400">
                  Ce message est envoyé automatiquement aux comptes jamais relancés après un récap, une fois le délai
                  « Relancer les oubliés » écoulé (réglage dans la page Abonnements).
                </span>
              </label>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setApercuAutoRelanceOpen(true)}
                  disabled={!user}
                  title="Voir le rendu exact de l'email d'auto-relance (aucun envoi n'est effectué)"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="ri-eye-line"></i>
                  Aperçu de l'email d'auto-relance
                </button>
              </div>

              <div className="h-px bg-background-200 my-1" />
              <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                Alerte email à l'artisan
              </p>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground-700">Objet de l'email d'alerte</span>
                <input
                  value={emailSujetAlerteArtisan}
                  onChange={(e) => setEmailSujetAlerteArtisan(e.target.value)}
                  placeholder="Auto-relance : {{nombre}} comptes recontactés aujourd'hui"
                  className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground-700">Texte de l'email d'alerte</span>
                <textarea
                  value={emailCorpsAlerteArtisan}
                  onChange={(e) => setEmailCorpsAlerteArtisan(e.target.value)}
                  rows={4}
                  placeholder={"Bonne nouvelle : l'auto-relance des comptes oubliés a réellement envoyé {{nombre}} email(s) de recontact aujourd'hui, pour les comptes suivants."}
                  className="px-3 py-2 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400 resize-none"
                />
                <span className="text-[11px] text-foreground-400">
                  Cet email vous prévient quand l'auto-relance des oubliés a réellement expédié des relances (le tableau des
                  comptes concernés est ajouté automatiquement sous votre texte). Laissez vide pour le message par défaut.
                </span>
              </label>
            </>
          )}
        </div>

        <div className="mt-4 p-3 rounded-md bg-background-50 border border-background-200">
          <p className="text-[11px] text-foreground-500 leading-relaxed">
            {emailTab === "recontact" ? (
              <>
                Variables utilisables (recopiées automatiquement) :{" "}
                <span className="text-foreground-700 font-medium">{"{{entreprise}}"}</span>,{" "}
                <span className="text-foreground-700 font-medium">{"{{nb}}"}</span>,{" "}
                <span className="text-foreground-700 font-medium">{"{{delai}}"}</span>. Le tableau des comptes concernés est
                ajouté automatiquement sous votre texte. Pour l'auto-relance des oubliés, utilisez{" "}
                <span className="text-foreground-700 font-medium">{"{{compte}}"}</span> (nom du compte recontacté) et{" "}
                <span className="text-foreground-700 font-medium">{"{{nombre}}"}</span> (nombre de comptes relancés). Pour
                l'alerte artisan, utilisez <span className="text-foreground-700 font-medium">{"{{nombre}}"}</span> (nombre de
                comptes recontactés) et <span className="text-foreground-700 font-medium">{"{{entreprise}}"}</span> (nom de
                votre entreprise).
                Laissez vide pour utiliser le message par défaut d'ArtiFlow-pro.
              </>
            ) : (
              <>
                Variables utilisables (recopiées automatiquement) :{" "}
                <span className="text-foreground-700 font-medium">{"{{client}}"}</span>,{" "}
                <span className="text-foreground-700 font-medium">{"{{entreprise}}"}</span>
                {emailTab !== "relance" && (
                  <>
                    ,{" "}
                    <span className="text-foreground-700 font-medium">{"{{numero}}"}</span>,{" "}
                    <span className="text-foreground-700 font-medium">{"{{objet}}"}</span>,{" "}
                    <span className="text-foreground-700 font-medium">{"{{montant}}"}</span>,{" "}
                    <span className="text-foreground-700 font-medium">{"{{echeance}}"}</span>
                  </>
                )}
                {emailTab === "devis" && (
                  <>
                    ,{" "}
                    <span className="text-foreground-700 font-medium">{"{{lien}}"}</span>
                  </>
                )}
                . Laissez vide pour utiliser le message par défaut d'ArtiFlow-pro.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Aperçu en direct des emails envoyés au client (couleur + logo du profil) */}
      {emailTab !== "recontact" && (
        <div className="p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-9 h-9 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
              <i className="ri-mail-open-line"></i>
            </span>
            <div>
              <h3 className="font-heading font-semibold text-base text-foreground-950">Aperçu en direct de l'email</h3>
              <p className="text-xs text-foreground-500">
                Voici le rendu reçu par votre client, avec votre couleur d'accent et votre logo. Les brouillons ci-dessus sont repris en direct.
              </p>
            </div>
          </div>
          <ApercuEmail
            type={emailTab}
            entreprise={entreprise}
            couleur={docCouleur}
            afficherLogo={docAfficherLogo}
            logoUrl={logoUrl}
            metier={metierLabel(metier)}
            telephone={profile?.telephone ?? ""}
            sujetDraft={emailTab === "devis" ? emailSujetDevis : emailTab === "facture" ? emailSujetFacture : emailSujetRelance}
            corpsDraft={emailTab === "devis" ? emailCorpsDevis : emailTab === "facture" ? emailCorpsFacture : emailCorpsRelance}
            piedPage={docPiedPage}
          />
        </div>
      )}

        </>
      )}

      {(tab === "entreprise" || tab === "emails") && (
        <>
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="text-xs text-accent-700 flex items-center gap-1.5">
          <i className="ri-checkbox-circle-line"></i>
          Vos informations ont bien été enregistrées.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {modifsNonEnregistrees && (
          <button
            type="button"
            onClick={handleReset}
            disabled={busy}
            title="Annuler les modifications non enregistrées et revenir aux valeurs enregistrées"
            className="inline-flex items-center gap-2 h-11 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className="ri-arrow-go-back-line"></i>
            Revenir aux valeurs enregistrées
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy}
          title={modifsNonEnregistrees ? "Des modifications restent à enregistrer" : "Enregistrer les modifications"}
          className={`inline-flex items-center gap-2 h-11 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
            modifsNonEnregistrees && !busy ? "animate-bouton-pulse" : ""
          }`}
        >
          {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
          Enregistrer les modifications
        </button>
      </div>
        </>
      )}

      {apercuAutoRelanceOpen && user && (
        <ApercuAutoRelanceModal
          userId={user.id}
          sujetDraft={emailSujetRecontactAuto}
          corpsDraft={emailCorpsRecontactAuto}
          onClose={() => setApercuAutoRelanceOpen(false)}
        />
      )}
    </div>
  );
}