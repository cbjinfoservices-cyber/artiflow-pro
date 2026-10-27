import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import LegalLayout, { LegalSection } from "@/components/feature/LegalLayout";
import { IMAGE_PARTAGE_RGPD } from "@/lib/imagesPartage";
import { DATE_CONDITIONS, EDITEUR, PRESTATAIRES } from "@/lib/documentsLegaux";

/**
 * Accord de sous-traitance (article 28 du RGPD), annexe des CGV accepté à l'inscription.
 * L'artisan (« le Client ») est responsable des données de ses clients et de son équipe ;
 * CBJ-INFOSERVICES (« le Prestataire ») les traite pour son compte.
 */

const sections = [
  { id: "objet", label: "1. Objet" },
  { id: "description", label: "2. Description du traitement" },
  { id: "instructions", label: "3. Instructions du Client" },
  { id: "confidentialite", label: "4. Confidentialité" },
  { id: "securite", label: "5. Sécurité" },
  { id: "sous-traitants", label: "6. Sous-traitants ultérieurs" },
  { id: "transferts", label: "7. Transferts hors UE" },
  { id: "droits", label: "8. Droits des personnes" },
  { id: "violations", label: "9. Violations de données" },
  { id: "assistance", label: "10. Assistance au Client" },
  { id: "fin", label: "11. Fin du contrat" },
  { id: "audit", label: "12. Documentation et audit" },
  { id: "client", label: "13. Obligations du Client" },
  { id: "duree", label: "14. Durée et prise d'effet" },
  { id: "annexe-a", label: "Annexe A — Sous-traitants" },
  { id: "annexe-b", label: "Annexe B — Mesures de sécurité" },
];

const description: [string, ReactNode][] = [
  ["Objet", "Mise à disposition du logiciel ArtiFlow-pro : devis, factures, relances, planning, suivi de chantier, gestion d'équipe et pointage."],
  ["Durée", "Durée de l'abonnement du Client, puis 30 jours après la demande de suppression du compte."],
  ["Nature des opérations", "Collecte via les formulaires du service, enregistrement, hébergement, consultation, mise en forme de documents, envoi d'emails et de SMS pour le compte du Client, effacement."],
  ["Finalités", "Permettre au Client de gérer sa relation avec ses clients, ses chantiers et son équipe."],
  ["Personnes concernées", "Clients et prospects du Client ; membres de son équipe (salariés, intervenants) ; interlocuteurs de ses clients professionnels."],
  ["Catégories de données", "Identité et coordonnées, adresses de chantier, devis et factures, signatures, photos de chantier, historique des envois ; pour l'équipe : planning, congés, heures pointées, procès-verbaux."],
  ["Données sensibles", "Aucune n'est requise par le service. Le Client s'abstient d'en enregistrer."],
];

const mesures = [
  "Chiffrement de toutes les communications (HTTPS / TLS, connexion chiffrée imposée par le site).",
  "Chiffrement des données stockées chez l'hébergeur de la base de données (AES-256).",
  "Mots de passe jamais conservés en clair (empreinte cryptographique).",
  "Cloisonnement par règles d'accès en base de données : chaque compte ne voit que ses propres données ; les membres d'équipe ne voient pas les montants ; le personnel du Prestataire n'a pas accès aux fichiers clients des comptes.",
  "Règles d'accès contrôlées par une série de tests dédiés (isolement entre comptes, équipe, gestionnaires, stockage).",
  "Serveurs d'administration accessibles uniquement par clé cryptographique, pare-feu, blocage automatique des tentatives d'intrusion, mises à jour de sécurité automatiques.",
  "Accès d'administration limités aux personnes habilitées, avec secrets d'accès renouvelés en cas d'exposition.",
  "Suppression automatique des données à l'expiration des durées de conservation.",
];

const lien = "font-semibold text-primary-700 hover:underline cursor-pointer";

function Tableau({ entetes, lignes }: { entetes: string[]; lignes: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-background-200">
      <table className="w-full min-w-[520px] border-collapse">
        <thead>
          <tr className="bg-background-100">
            {entetes.map((e) => (
              <th key={e} className="text-left px-4 py-3 text-sm font-semibold text-foreground-700">
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((cellules, i) => (
            <tr key={i} className="border-t border-background-200 align-top">
              {cellules.map((c, j) => (
                <td key={j} className={`px-4 py-3 text-sm ${j === 0 ? "text-foreground-800 font-medium" : "text-foreground-600"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Liste({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <i className="ri-checkbox-circle-line text-secondary-600 mt-0.5"></i>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AccordSousTraitancePage() {
  return (
    <LegalLayout
      path="/accord-sous-traitance"
      eyebrow="Annexe aux CGV"
      eyebrowIcon="ri-shake-hands-line"
      title="Accord de sous-traitance des données"
      intro="Cet accord encadre, conformément à l'article 28 du RGPD, le traitement des données de vos clients et de votre équipe par ArtiFlow-pro. Il fait partie intégrante des conditions générales acceptées lors de votre inscription."
      updatedAt={DATE_CONDITIONS}
      metaTitle="Accord de sous-traitance RGPD · ArtiFlow-pro"
      metaDescription="Accord de sous-traitance (article 28 du RGPD) entre ArtiFlow-pro et ses clients artisans : données traitées, sécurité, sous-traitants, violations de données et fin du contrat."
      metaImage={IMAGE_PARTAGE_RGPD}
      breadcrumbLabel="Accord de sous-traitance"
      breadcrumbSchemaId="artiflow-dpa-breadcrumb-schema"
      sections={sections}
    >
      <LegalSection id="objet" title="1. Objet">
        <p>
          Le présent accord est conclu entre <strong>{EDITEUR.nom}</strong>, {EDITEUR.forme} dont le siège est situé{" "}
          {EDITEUR.adresse} (SIREN {EDITEUR.siren}), éditeur d'ArtiFlow-pro (le « <strong>Prestataire</strong> »), et
          toute entreprise abonnée au service (le « <strong>Client</strong> »).
        </p>
        <p>
          Pour les données personnelles que le Client enregistre dans ArtiFlow-pro au sujet de ses clients et de son
          équipe, le Client est <strong>responsable du traitement</strong> et le Prestataire agit en qualité de{" "}
          <strong>sous-traitant</strong>. Le présent accord constitue une annexe des{" "}
          <Link to="/cgv" className={lien}>
            conditions générales
          </Link>{" "}
          ; en cas de contradiction sur la protection des données, il prévaut.
        </p>
      </LegalSection>

      <LegalSection id="description" title="2. Description du traitement">
        <Tableau entetes={["Élément", "Description"]} lignes={description.map(([a, b]) => [a, b])} />
      </LegalSection>

      <LegalSection id="instructions" title="3. Instructions du Client">
        <p>
          Le Prestataire traite les données uniquement sur instruction documentée du Client. Constituent ces
          instructions : les conditions générales, le présent accord, et les actions que le Client effectue dans le
          service (création d'un devis, envoi d'une relance, invitation d'un intervenant, etc.).
        </p>
        <p>
          Le Prestataire n'utilise pas les données pour ses propres besoins, ne les vend pas, ne les exploite pas à des
          fins publicitaires et ne s'en sert pas pour entraîner des modèles d'intelligence artificielle. Si une
          instruction lui paraît contraire à la réglementation, il en informe immédiatement le Client.
        </p>
      </LegalSection>

      <LegalSection id="confidentialite" title="4. Confidentialité">
        <p>
          Les personnes autorisées à traiter les données pour le compte du Prestataire sont soumises à une obligation
          de confidentialité. Elles n'y accèdent que lorsque c'est nécessaire, notamment pour répondre à une demande
          d'assistance du Client.
        </p>
      </LegalSection>

      <LegalSection id="securite" title="5. Sécurité">
        <p>
          Le Prestataire met en œuvre les mesures techniques et organisationnelles décrites en annexe B, adaptées au
          risque, conformément à l'article 32 du RGPD. Il les fait évoluer avec l'état de l'art sans en réduire le
          niveau de protection.
        </p>
      </LegalSection>

      <LegalSection id="sous-traitants" title="6. Sous-traitants ultérieurs">
        <p>
          Le Client autorise le Prestataire à faire appel aux sous-traitants ultérieurs listés en annexe A. Le
          Prestataire leur impose par contrat des obligations de protection équivalentes au présent accord et demeure
          responsable de leur respect.
        </p>
        <p>
          Tout ajout ou remplacement est annoncé au Client par email au moins <strong>30 jours</strong> à l'avance. Le
          Client peut s'y opposer pour un motif légitime ; à défaut d'accord, il peut résilier son abonnement sans frais
          avant la prise d'effet du changement.
        </p>
      </LegalSection>

      <LegalSection id="transferts" title="7. Transferts hors de l'Union européenne">
        <p>
          Les données sont hébergées dans l'Union européenne. Un transfert hors de l'Union n'intervient que vers les
          sous-traitants identifiés en annexe A, et uniquement s'il est encadré par des garanties appropriées
          (décision d'adéquation, dont le cadre UE–États-Unis de protection des données, ou clauses contractuelles
          types de la Commission européenne).
        </p>
      </LegalSection>

      <LegalSection id="droits" title="8. Droits des personnes concernées">
        <p>
          Le service permet au Client de consulter, corriger, exporter et supprimer les données de ses clients et de
          son équipe. Si une personne s'adresse directement au Prestataire, celui-ci transmet sa demande au Client
          dans les meilleurs délais, sans y répondre lui-même sauf instruction du Client, et l'aide techniquement à y
          donner suite.
        </p>
      </LegalSection>

      <LegalSection id="violations" title="9. Violations de données">
        <p>
          Le Prestataire notifie au Client toute violation de données personnelles le concernant{" "}
          <strong>dans les meilleurs délais et au plus tard 48 heures</strong> après en avoir pris connaissance, par
          email à l'adresse du compte. La notification précise, dans la mesure du possible : la nature de la violation,
          les catégories et le nombre approximatif de personnes et de données concernées, les conséquences probables et
          les mesures prises ou envisagées. Il fournit ensuite les informations complémentaires dont le Client a besoin
          pour notifier la CNIL et, le cas échéant, les personnes concernées.
        </p>
      </LegalSection>

      <LegalSection id="assistance" title="10. Assistance au Client">
        <p>
          Le Prestataire aide le Client, en fonction des informations dont il dispose, à garantir le respect de ses
          obligations de sécurité, de notification des violations, et, le cas échéant, à réaliser une analyse d'impact
          ou à consulter la CNIL.
        </p>
      </LegalSection>

      <LegalSection id="fin" title="11. Fin du contrat">
        <p>
          Pendant toute la durée de l'abonnement, le Client peut exporter ses données. À la suppression du compte, les
          données sont conservées 30 jours, délai pendant lequel le Client peut annuler sa demande, puis{" "}
          <strong>effacées définitivement</strong>, sauf obligation légale de conservation à la charge du Prestataire.
          Le détail de la procédure figure sur la page{" "}
          <Link to="/suppression-compte" className={lien}>
            Supprimer votre compte
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="audit" title="12. Documentation et audit">
        <p>
          Le Prestataire met à la disposition du Client, sur demande écrite, les informations nécessaires pour
          démontrer le respect du présent accord. Le Client peut faire réaliser un audit, au plus une fois par an, à ses
          frais, par un auditeur tenu au secret, moyennant un préavis de 30 jours et sans perturber le fonctionnement du
          service ni compromettre la sécurité des autres clients.
        </p>
      </LegalSection>

      <LegalSection id="client" title="13. Obligations du Client">
        <Liste
          items={[
            "Disposer d'une base légale pour chaque donnée qu'il enregistre, et n'enregistrer que des données nécessaires.",
            "Informer ses clients et les membres de son équipe des traitements les concernant, notamment du pointage des heures pour ses salariés.",
            "Ne pas enregistrer de données sensibles (santé, opinions, etc.) dans le service.",
            "Protéger ses identifiants et ceux qu'il crée pour son équipe, et retirer l'accès d'un intervenant qui quitte l'entreprise.",
            "Conserver lui-même, hors du service si nécessaire, les documents soumis à une obligation légale de conservation (factures, paie).",
          ]}
        />
      </LegalSection>

      <LegalSection id="duree" title="14. Durée et prise d'effet">
        <p>
          Le présent accord prend effet à l'acceptation des conditions générales lors de l'inscription et reste en
          vigueur tant que le Prestataire traite des données pour le compte du Client. Les obligations de
          confidentialité et d'effacement survivent à sa fin. Version du {DATE_CONDITIONS}.
        </p>
      </LegalSection>

      <LegalSection id="annexe-a" title="Annexe A — Sous-traitants ultérieurs autorisés">
        <Tableau entetes={["Sous-traitant", "Rôle", "Localisation des données"]} lignes={PRESTATAIRES.map((p) => [p.nom, p.role, p.lieu])} />
        <p>
          Seuls la description des travaux saisie pour un devis et le métier du Client sont transmis à OpenAI, sans
          identifiant de compte ni coordonnées des clients.
        </p>
      </LegalSection>

      <LegalSection id="annexe-b" title="Annexe B — Mesures de sécurité">
        <Liste items={mesures} />
      </LegalSection>
    </LegalLayout>
  );
}
