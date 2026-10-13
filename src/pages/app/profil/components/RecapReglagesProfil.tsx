import type { ReactNode } from "react";
import { metierLabel } from "@/lib/metiers";
import type { OngletProfil } from "@/lib/profilPrefs";
import type { Profile } from "@/hooks/useAuth";

/** Sous-onglets de la section « Emails » de la page Profil. */
export type EmailTabProfil = "devis" | "facture" | "relance" | "recontact";

/**
 * Cible de navigation depuis une ligne du récapitulatif : l'onglet à ouvrir, le
 * sous-onglet d'emails éventuel, et l'ancre de la section à amener à l'écran.
 */
export interface CibleProfil {
  onglet: OngletProfil;
  emailTab?: EmailTabProfil;
  ancre?: string;
}

/** Formate une heure entière en « HH:00 », ou « — » si absente. */
function heure(valeur: number | null | undefined): string {
  if (valeur === null || valeur === undefined || Number.isNaN(valeur)) return "—";
  return `${String(valeur).padStart(2, "0")}:00`;
}

interface RecapLigneProps {
  label: string;
  valeur: string;
  icone?: string;
  /** État booléen optionnel : coche pleine si vrai, point neutre si faux. */
  actif?: boolean;
  /** Si fourni, la ligne devient cliquable et ouvre la section correspondante. */
  cible?: CibleProfil;
  onNaviguer?: (cible: CibleProfil) => void;
}

/** Une ligne « libellé · valeur » du récapitulatif (cliquable si une cible est fournie). */
function RecapLigne({ label, valeur, icone, actif, cible, onNaviguer }: RecapLigneProps) {
  const cliquable = Boolean(cible && onNaviguer);

  const contenu = (
    <>
      <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5 min-w-0">
        {icone && <i className={`${icone} text-foreground-400`}></i>}
        {label}
      </span>
      <span className="text-[11px] font-semibold text-foreground-900 text-right inline-flex items-center gap-1.5 min-w-0">
        {actif !== undefined && (
          <i
            className={
              actif ? "ri-checkbox-circle-fill text-accent-500" : "ri-checkbox-blank-circle-line text-foreground-300"
            }
          ></i>
        )}
        <span className="break-words">{valeur}</span>
        {cliquable && (
          <i className="ri-arrow-right-s-line text-foreground-300 group-hover/recap:text-primary-600 group-hover/recap:translate-x-0.5 transition-transform"></i>
        )}
      </span>
    </>
  );

  if (cliquable) {
    return (
      <button
        type="button"
        onClick={() => onNaviguer?.(cible as CibleProfil)}
        title="Ouvrir la section correspondante"
        className="group/recap flex items-start justify-between gap-3 py-1.5 -mx-1.5 px-1.5 rounded-sm border-b border-background-200/60 last:border-0 text-left cursor-pointer hover:bg-background-100 transition-colors"
      >
        {contenu}
      </button>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-background-200/60 last:border-0">
      {contenu}
    </div>
  );
}

/** Un bloc (colonne) du récapitulatif, avec son titre. */
function RecapSection({ titre, icone, children }: { titre: string; icone: string; children: ReactNode }) {
  return (
    <div className="rounded-md bg-background-50 border border-background-200 p-3">
      <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide inline-flex items-center gap-1.5 mb-1.5">
        <i className={`${icone} text-accent-600`}></i>
        {titre}
      </p>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

interface RecapReglagesProfilProps {
  /** Profil artisan enregistré (lu depuis le Backend). */
  profile: Profile | null;
  /** Ouvre l'onglet / la section correspondant à la ligne cliquée. */
  onNaviguer?: (cible: CibleProfil) => void;
}

/**
 * Récapitulatif complet des réglages **enregistrés** dans le profil : entreprise &
 * mentions légales, automatismes (récap quotidien, relances, rappels, seuils) et
 * personnalisation des emails (modèle personnalisé ou par défaut). Sert de synthèse
 * dans l'onglet Historique : on lit d'un coup d'œil ce qui est actuellement actif,
 * sans avoir à parcourir chaque onglet. Chaque ligne est cliquable et renvoie
 * directement vers la section qu'elle résume.
 */
export default function RecapReglagesProfil({ profile, onNaviguer }: RecapReglagesProfilProps) {
  if (!profile) {
    return (
      <div className="p-5 rounded-lg bg-background-100 border border-background-200">
        <p className="text-xs text-foreground-500 inline-flex items-center gap-1.5">
          <i className="ri-loader-4-line animate-spin"></i>
          Chargement de votre récapitulatif de réglages…
        </p>
      </div>
    );
  }

  const modeles: { cle: string; label: string; sujet: string | null | undefined; corps: string | null | undefined; icone: string; emailTab: EmailTabProfil }[] = [
    { cle: "devis", label: "Devis", sujet: profile.email_sujet_devis, corps: profile.email_corps_devis, icone: "ri-file-text-line", emailTab: "devis" },
    { cle: "facture", label: "Factures", sujet: profile.email_sujet_facture, corps: profile.email_corps_facture, icone: "ri-receipt-line", emailTab: "facture" },
    { cle: "relance", label: "Relances client", sujet: profile.email_sujet_relance, corps: profile.email_corps_relance, icone: "ri-send-plane-line", emailTab: "relance" },
    { cle: "recontact", label: "Récap recontact", sujet: profile.email_sujet_recontact, corps: profile.email_corps_recontact, icone: "ri-repeat-2-line", emailTab: "recontact" },
    { cle: "auto-relance", label: "Auto-relance oubliés", sujet: profile.email_sujet_recontact_auto, corps: profile.email_corps_recontact_auto, icone: "ri-robot-2-line", emailTab: "recontact" },
    { cle: "alerte", label: "Alerte artisan", sujet: profile.email_sujet_alerte_artisan, corps: profile.email_corps_alerte_artisan, icone: "ri-notification-3-line", emailTab: "recontact" },
  ];

  const adresses = Array.isArray(profile.comptable_override_adresses) ? profile.comptable_override_adresses : [];
  const canaux = Array.isArray(profile.recap_canaux) ? profile.recap_canaux : [];

  return (
    <div className="p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-9 h-9 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
          <i className="ri-file-list-3-line"></i>
        </span>
        <div>
          <h3 className="font-heading font-semibold text-base text-foreground-950">
            Récap de vos réglages enregistrés
          </h3>
          <p className="text-xs text-foreground-500">
            Vue d'ensemble de tout ce qui est actuellement enregistré. Cliquez sur une ligne pour ouvrir la section.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <RecapSection titre="Entreprise & mentions" icone="ri-building-line">
          <RecapLigne label="Entreprise" valeur={profile.entreprise?.trim() || "Non renseignée"} icone="ri-home-4-line" onNaviguer={onNaviguer} cible={{ onglet: "entreprise", ancre: "profil-infos-entreprise" }} />
          <RecapLigne label="Métier" valeur={metierLabel(profile.metier ?? "") || "Non renseigné"} icone="ri-tools-line" onNaviguer={onNaviguer} cible={{ onglet: "entreprise", ancre: "profil-infos-entreprise" }} />
          <RecapLigne label="Téléphone" valeur={profile.telephone?.trim() || "Non renseigné"} icone="ri-phone-line" onNaviguer={onNaviguer} cible={{ onglet: "entreprise", ancre: "profil-infos-entreprise" }} />
          <RecapLigne label="Logo" valeur={profile.logo_url ? "Ajouté" : "Aucun"} icone="ri-image-line" actif={Boolean(profile.logo_url)} onNaviguer={onNaviguer} cible={{ onglet: "entreprise", ancre: "profil-infos-entreprise" }} />
          <RecapLigne label="SIRET" valeur={profile.siret?.trim() || "Non renseigné"} icone="ri-hashtag" actif={Boolean(profile.siret?.trim())} onNaviguer={onNaviguer} cible={{ onglet: "entreprise", ancre: "profil-mentions-legales" }} />
          <RecapLigne label="N° TVA" valeur={profile.tva?.trim() || "Non renseigné"} icone="ri-percent-line" actif={Boolean(profile.tva?.trim())} onNaviguer={onNaviguer} cible={{ onglet: "entreprise", ancre: "profil-mentions-legales" }} />
          <RecapLigne label="Assurance" valeur={profile.assurance?.trim() || "Non renseignée"} icone="ri-shield-check-line" actif={Boolean(profile.assurance?.trim())} onNaviguer={onNaviguer} cible={{ onglet: "entreprise", ancre: "profil-mentions-legales" }} />
          <RecapLigne label="Pénalités de retard" valeur={profile.penalites_retard?.trim() || "Non renseignées"} icone="ri-alarm-warning-line" actif={Boolean(profile.penalites_retard?.trim())} onNaviguer={onNaviguer} cible={{ onglet: "entreprise", ancre: "profil-mentions-legales" }} />
        </RecapSection>

        <RecapSection titre="Automatismes" icone="ri-mail-check-line">
          <RecapLigne
            label="Récap quotidien"
            valeur={profile.recap_quotidien_actif ? `Activé · ${heure(profile.recap_heure)}` : "Coupé"}
            icone="ri-calendar-check-line"
            actif={Boolean(profile.recap_quotidien_actif)}
            onNaviguer={onNaviguer}
            cible={{ onglet: "automatismes", ancre: "profil-automatismes" }}
          />
          <RecapLigne label="Canaux du récap" valeur={canaux.length ? canaux.join(" · ") : "Aucun"} icone="ri-share-forward-line" onNaviguer={onNaviguer} cible={{ onglet: "automatismes", ancre: "profil-automatismes" }} />
          <RecapLigne label="Devis sans réponse" valeur={profile.recap_devis_seuil ? `après ${profile.recap_devis_seuil} j` : "—"} icone="ri-file-text-line" onNaviguer={onNaviguer} cible={{ onglet: "automatismes", ancre: "profil-automatismes" }} />
          <RecapLigne
            label="Relance auto factures"
            valeur={profile.relance_facture_auto_actif ? `Activée · +${profile.relance_facture_seuil ?? "?"} j` : "Coupée"}
            icone="ri-refresh-line"
            actif={Boolean(profile.relance_facture_auto_actif)}
            onNaviguer={onNaviguer}
            cible={{ onglet: "automatismes", ancre: "profil-automatismes" }}
          />
          <RecapLigne label="Délai anti-doublon" valeur={profile.relance_facture_delai_min ? `${profile.relance_facture_delai_min} j` : "—"} icone="ri-timer-line" onNaviguer={onNaviguer} cible={{ onglet: "automatismes", ancre: "profil-automatismes" }} />
          <RecapLigne
            label="Rappel la veille"
            valeur={profile.rappel_relance_actif ? `Activé · ${heure(profile.rappel_relance_heure)}` : "Coupé"}
            icone="ri-notification-3-line"
            actif={Boolean(profile.rappel_relance_actif)}
            onNaviguer={onNaviguer}
            cible={{ onglet: "automatismes", ancre: "profil-automatismes" }}
          />
          <RecapLigne
            label="Adresses comptables"
            valeur={adresses.length ? `${adresses.length} enregistrée${adresses.length > 1 ? "s" : ""}` : "Aucune"}
            icone="ri-bookmark-3-line"
            onNaviguer={onNaviguer}
            cible={{ onglet: "automatismes", ancre: "profil-adresses-comptables" }}
          />
        </RecapSection>

        <RecapSection titre="Emails personnalisés" icone="ri-mail-settings-line">
          {modeles.map((m) => {
            const perso = Boolean((m.sujet && m.sujet.trim()) || (m.corps && m.corps.trim()));
            return (
              <RecapLigne
                key={m.cle}
                label={m.label}
                valeur={perso ? "Personnalisé" : "Modèle par défaut"}
                icone={m.icone}
                actif={perso}
                onNaviguer={onNaviguer}
                cible={{ onglet: "emails", emailTab: m.emailTab, ancre: "profil-emails" }}
              />
            );
          })}
        </RecapSection>
      </div>
    </div>
  );
}