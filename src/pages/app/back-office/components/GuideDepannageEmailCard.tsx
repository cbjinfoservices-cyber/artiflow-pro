import { useState } from "react";

/** Étape du guide de dépannage côté envoi d'emails (Resend). */
interface EtapeDepannageEmail {
  icon: string;
  titre: string;
  texte: string;
}

/** Gestes à faire, dans l'ordre, quand un email ne part plus. */
const ETAPES: EtapeDepannageEmail[] = [
  {
    icon: "ri-shield-check-line",
    titre: "Lire d'abord la carte « Envoi des emails »",
    texte:
      "Elle dit la vérité en une ligne : « Prêt à envoyer » si tout est bon, « À finaliser » sinon. Trois voyants doivent être verts — clé API présente, domaine configuré, domaine vérifié chez Resend. Inutile de chercher ailleurs tant qu'un de ces trois points est rouge.",
  },
  {
    icon: "ri-key-2-line",
    titre: "Vérifier la clé API Resend",
    texte:
      "Si la ligne « Clé API d'envoi » est rouge, aucune email ne peut partir, quel que soit le réglage DNS. La clé se dépose depuis le panneau Resend du produit, jamais dans le code. Après un dépôt, cliquer « Re-vérifier » : la carte se met à jour dans la seconde.",
  },
  {
    icon: "ri-verified-badge-line",
    titre: "Vérifier le domaine chez Resend",
    texte:
      "Un domaine affiché « Non démarré » ou « Échec de vérification » bloque l'envoi. Resend valide le domaine, pas chaque adresse : c'est pour ça qu'il n'y a plus aucune adresse expéditrice à activer une par une.",
  },
  {
    icon: "ri-global-line",
    titre: "Contrôler les enregistrements DNS affichés dans la carte",
    texte:
      "Le bloc « Vérification DNS » liste exactement ce que Resend attend, avec le nom, la valeur et le statut de chaque ligne. Tant qu'une ligne reste « À faire », la délivrabilité n'est pas garantie. Attention au CNAME en mode « DNS only » chez Cloudflare, sinon il est masqué et reste invisible pour Resend.",
  },
  {
    icon: "ri-forbid-line",
    titre: "Un seul SPF, un seul DMARC",
    texte:
      "Deux enregistrements TXT commençant par « v=spf1 » à la racine cassent l'authentification : la carte le signale en rouge. Il faut en garder un seul et fusionner les mécanismes à l'intérieur. Même règle pour _dmarc.",
  },
  {
    icon: "ri-send-plane-line",
    titre: "Envoyer un email de test et lire l'historique",
    texte:
      "Le bouton « Envoyer un email de test » écrit une ligne dans « Derniers tests d'email », avec le destinataire, la date et le motif d'échec éventuel. C'est la preuve de bout en bout : si le test arrive, le canal est bon même si un client dit ne rien avoir reçu.",
  },
  {
    icon: "ri-mail-open-line",
    titre: "Si le test part mais n'arrive pas",
    texte:
      "Regarder les indésirables, puis le suivi des envois du back-office : un statut « bounced » signifie que la boîte du destinataire a refusé le message (adresse morte, serveur strict). Un statut « complained » signifie que le message a été signalé en spam.",
  },
  {
    icon: "ri-database-2-line",
    titre: "Si plusieurs envois échouent d'un coup",
    texte:
      "Consulter la carte « Suivi des envois » : le motif de la dernière erreur y est écrit en clair (quota, domaine non vérifié, clé invalide). C'est ce message qu'il faut corriger, pas la mise en page de l'email.",
  },
];

/** Anciens enregistrements à retirer : ils ne concernent plus l'envoi d'emails. */
const A_SUPPRIMER: Array<{ type: string; nom: string; pourquoi: string }> = [
  {
    type: "CNAME",
    nom: "mail._domainkey",
    pourquoi: "Signature DKIM de l'ancien fournisseur. Resend utilise son propre sélecteur, aucun conflit : cette ligne peut être supprimée.",
  },
  {
    type: "CNAME",
    nom: "brevo._domainkey",
    pourquoi: "Second sélecteur DKIM de l'ancien fournisseur, devenu inutile.",
  },
  {
    type: "TXT",
    nom: "racine du domaine",
    pourquoi: "Tout enregistrement de vérification de propriété de l'ancien fournisseur (valeur du type « brevo-code=… »). Les SPF et les DKIM Resend ne doivent pas y toucher.",
  },
  {
    type: "MX",
    nom: "racine du domaine",
    pourquoi: "Seulement si un MX d'ancien fournisseur d'envoi traîne encore : un MX ne sert qu'à recevoir. Garder uniquement le MX de la boîte de réception réellement utilisée.",
  },
];

/** Enregistrements à ne jamais supprimer. */
const A_GARDER: Array<{ type: string; nom: string; pourquoi: string }> = [
  {
    type: "A / CNAME",
    nom: "racine + www",
    pourquoi: "Ils font fonctionner le site. Ce sont les seuls enregistrements à ne jamais toucher.",
  },
  {
    type: "TXT",
    nom: "racine (SPF)",
    pourquoi: "L'unique ligne « v=spf1 » doit rester, en retirant à l'intérieur la portion de l'ancien fournisseur.",
  },
  {
    type: "TXT",
    nom: "resend._domainkey",
    pourquoi: "Signature DKIM de Resend : c'est elle qui authentifie les emails sortants.",
  },
  {
    type: "TXT",
    nom: "_dmarc",
    pourquoi: "Politique DMARC. À conserver et à ne jamais dupliquer.",
  },
];

/**
 * Guide de dépannage back-office : « Un email ne part plus ? ».
 *
 * Pendant longtemps, ce mémo renvoyait vers l'ancien fournisseur : créer une boîte mail
 * expéditrice, cliquer un lien d'activation, transférer le domaine. Plus rien de tout ça
 * n'est nécessaire — Resend valide le domaine, pas chaque adresse. Ce guide a été réécrit
 * autour de Resend, et il rappelle aussi quels anciens enregistrements DNS peuvent être
 * nettoyés sans risque.
 */
export default function GuideDepannageEmailCard() {
  const [ouvert, setOuvert] = useState(false);

  return (
    <section className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-background-200/50">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
            <i className="ri-lifebuoy-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-bold text-sm text-foreground-950">Un email ne part plus ?</h3>
            <p className="text-[11px] text-foreground-500">
              Mémo de dépannage côté Resend, à suivre dans l'ordre.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://resend.com/domains"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
          >
            <i className="ri-external-link-line"></i>
            Ouvrir Resend
          </a>
          <button
            type="button"
            onClick={() => setOuvert((v) => !v)}
            aria-expanded={ouvert}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
          >
            <i className={ouvert ? "ri-eye-off-line" : "ri-eye-line"}></i>
            {ouvert ? "Masquer le guide" : "Afficher le guide"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-5 py-3 border-b border-background-200">
        <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
          <i className="ri-checkbox-circle-line"></i>
          Resend valide le domaine, pas les adresses
        </span>
        <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap">
          <i className="ri-close-circle-line"></i>
          Aucune boîte mail à créer chez un second fournisseur
        </span>
        <span className="ml-auto text-[11px] text-foreground-400 whitespace-nowrap">
          8 étapes · nettoyage DNS inclus
        </span>
      </div>

      {ouvert && (
        <div className="flex flex-col gap-4 p-5">
          <ol className="flex flex-col gap-2.5">
            {ETAPES.map((etape, i) => (
              <li
                key={etape.titre}
                className="flex gap-3.5 p-3.5 rounded-lg bg-background-50 border border-background-200"
              >
                <div className="flex flex-col items-center shrink-0">
                  <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                    <i className={`${etape.icon} text-lg`}></i>
                  </span>
                  <span className="mt-1.5 text-[11px] font-bold tabular-nums text-foreground-400">{i + 1}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-semibold text-sm text-foreground-950">{etape.titre}</p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground-600">{etape.texte}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="rounded-lg bg-background-50 border border-background-200 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-background-200/50">
              <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
                <i className="ri-delete-bin-6-line"></i>
              </span>
              <p className="font-heading font-semibold text-sm text-foreground-950">
                Nettoyage des anciens enregistrements
              </p>
              <span className="ml-auto inline-flex items-center h-6 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
                Facultatif
              </span>
            </div>
            <div className="p-4">
              <p className="text-xs leading-relaxed text-foreground-600">
                Ces lignes ne servent plus à rien depuis la bascule. Les retirer allège la zone DNS et évite de
                croire qu'un ancien fournisseur est encore actif. Rien ne casse si elles restent : ce n'est pas
                une urgence, juste du rangement.
              </p>

              <ul className="mt-3 flex flex-col gap-2">
                {A_SUPPRIMER.map((r) => (
                  <li
                    key={`${r.type}-${r.nom}`}
                    className="flex flex-wrap items-start gap-3 p-2.5 rounded-md bg-background-100 border border-background-200"
                  >
                    <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
                      <i className="ri-subtract-line"></i>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="inline-flex items-center h-5 px-1.5 rounded bg-background-200 text-foreground-700 text-[10px] font-bold whitespace-nowrap">
                          {r.type}
                        </span>
                        <span className="font-mono text-xs text-foreground-900 break-all">{r.nom}</span>
                      </div>
                      <p className="text-[11px] text-foreground-500 mt-1 leading-relaxed">{r.pourquoi}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
                À conserver absolument
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {A_GARDER.map((r) => (
                  <li
                    key={`${r.type}-${r.nom}`}
                    className="flex flex-wrap items-start gap-3 p-2.5 rounded-md bg-accent-100/50 border border-accent-200"
                  >
                    <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-accent-100 text-accent-800">
                      <i className="ri-lock-line"></i>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="inline-flex items-center h-5 px-1.5 rounded bg-background-50 text-foreground-700 text-[10px] font-bold whitespace-nowrap">
                          {r.type}
                        </span>
                        <span className="font-mono text-xs text-foreground-900 break-all">{r.nom}</span>
                      </div>
                      <p className="text-[11px] text-foreground-600 mt-1 leading-relaxed">{r.pourquoi}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <p className="mt-3 text-[11px] text-foreground-500 leading-relaxed">
                Avant toute suppression, noter les lignes existantes à part. En cas de doute, ne rien toucher :
                un enregistrement en trop ne gêne pas, alors qu'une suppression malheureuse peut couper le site
                ou la réception du courrier.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-2.5 p-3.5 rounded-lg bg-secondary-100/60 border border-secondary-200">
            <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-800">
              <i className="ri-information-line"></i>
            </span>
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-secondary-900">
              Trois réflexes hérités du précédent fournisseur ne servent plus à rien : créer une boîte mail
              expéditrice, faire valider chaque adresse une par une, et transférer le domaine. Si un prestataire
              affirme le contraire, c'est un argument commercial, pas une contrainte technique.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}