import { useState } from "react";
import type { VerificationDnsEmail, VerifEnregistrementDns } from "@/lib/diagnosticEmail";

/**
 * Bloc « Vérification DNS » de la carte d'envoi des emails.
 *
 * Il lit le résultat réel obtenu par le Backend : les enregistrements que Resend attend
 * pour le domaine d'envoi, leur statut de validation, ainsi que le SPF et le DMARC
 * réellement publiés. Chaque ligne s'affiche en vert ou en rouge, et les doublons
 * SPF / DMARC sont signalés explicitement car ils cassent la délivrabilité.
 *
 * Le bloc affiche aussi l'hébergeur DNS détecté (serveurs de noms du domaine) : c'est ce
 * qui permet de savoir où coller les enregistrements, et sous quels libellés.
 */
export default function DiagnosticDnsEmail({
  dns,
  chargement = false,
}: {
  /** Résultat du diagnostic DNS, ou null tant qu'aucun domaine n'est configuré. */
  dns: VerificationDnsEmail | null;
  /** Vrai pendant la vérification, pour l'indicateur de chargement. */
  chargement?: boolean;
}) {
  const [copie, setCopie] = useState<string | null>(null);

  const copier = async (cle: string, valeur: string) => {
    try {
      await navigator.clipboard.writeText(valeur);
      setCopie(cle);
      window.setTimeout(() => setCopie(null), 2000);
    } catch {
      setCopie(null);
    }
  };

  if (chargement && !dns) {
    return (
      <div className="mt-4 p-4 rounded-lg bg-background-50 border border-background-200">
        <p className="text-xs text-foreground-500 flex items-center gap-1.5">
          <i className="ri-loader-4-line animate-spin"></i>
          Lecture des enregistrements DNS du domaine…
        </p>
      </div>
    );
  }

  if (!dns) {
    return (
      <div className="mt-4 p-4 rounded-lg bg-background-50 border border-background-200">
        <p className="text-sm font-semibold text-foreground-800 flex items-center gap-1.5">
          <i className="ri-global-line text-foreground-500"></i>
          Vérification DNS des enregistrements Resend
        </p>
        <p className="mt-1.5 text-xs text-foreground-500">
          Aucun domaine d'envoi configuré pour l'instant : ajoutez d'abord votre domaine dans Resend pour que les
          enregistrements DNS puissent être contrôlés.
        </p>
      </div>
    );
  }

  const valides = dns.enregistrements.filter((e) => e.ok).length;
  const total = dns.enregistrements.length;
  const avertissements = dns.avertissements ?? [];
  const cloudflare = dns.hebergeur.toLowerCase().includes("cloudflare");

  /** Une ligne d'enregistrement : type, nom, valeur attendue et verdict vert / rouge. */
  const Ligne = ({ enregistrement }: { enregistrement: VerifEnregistrementDns }) => {
    const ok = enregistrement.ok;
    const ton = ok ? "bg-accent-100 text-accent-700" : "bg-red-100 text-red-700";
    return (
      <li className="p-3 rounded-md bg-background-50 border border-background-200">
        <div className="flex flex-wrap items-start gap-3">
          <span className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-md ${ton}`}>
            <i className={ok ? "ri-checkbox-circle-line" : "ri-close-circle-line"}></i>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm font-semibold text-foreground-900">{enregistrement.libelle}</p>
              <span className="inline-flex items-center h-5 px-1.5 rounded bg-secondary-100 text-secondary-800 text-[10px] font-bold whitespace-nowrap">
                {enregistrement.type}
              </span>
            </div>
            <p className="text-[11px] text-foreground-500 mt-0.5 break-words">{enregistrement.detail}</p>

            <dl className="mt-2 grid grid-cols-1 gap-1 text-[11px]">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <dt className="text-foreground-500 font-semibold shrink-0">Nom / hôte :</dt>
                <dd className="font-mono text-foreground-800 break-all">{enregistrement.nom}</dd>
              </div>
              <div className="flex flex-wrap items-baseline gap-1.5">
                <dt className="text-foreground-500 font-semibold shrink-0">Valeur à saisir :</dt>
                <dd className="font-mono text-foreground-800 break-all">{enregistrement.attendu}</dd>
                <button
                  type="button"
                  onClick={() => void copier(enregistrement.cle, enregistrement.attendu)}
                  title="Copier cette valeur"
                  className="inline-flex items-center gap-1 h-5 px-1.5 rounded bg-background-100 border border-background-300 text-[10px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
                >
                  <i className={copie === enregistrement.cle ? "ri-check-line" : "ri-file-copy-line"}></i>
                  {copie === enregistrement.cle ? "Copié" : "Copier"}
                </button>
              </div>
            </dl>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-bold whitespace-nowrap ${ton}`}
          >
            <i className={ok ? "ri-check-line" : "ri-close-line"}></i>
            {ok ? "Validé" : enregistrement.divergent ? "Incorrect" : "À faire"}
          </span>
        </div>
      </li>
    );
  };

  return (
    <div className="mt-5 pt-4 border-t border-background-200">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground-800 flex items-center gap-1.5">
            <i className="ri-global-line text-foreground-500"></i>
            Vérification DNS des enregistrements Resend
          </p>
          <p className="text-[11px] text-foreground-500 mt-0.5 max-w-2xl leading-relaxed">
            Domaines et enregistrements lus directement chez Resend pour{" "}
            <span className="font-semibold text-foreground-700">{dns.domaine}</span> : chaque ligne passe au vert dès
            que Resend valide l'enregistrement publié chez votre hébergeur.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-bold whitespace-nowrap ${
            dns.complet ? "bg-accent-100 text-accent-700" : "bg-primary-100 text-primary-700"
          }`}
        >
          <i className={dns.complet ? "ri-shield-check-line" : "ri-error-warning-line"}></i>
          {valides}/{total} enregistrements validés
        </span>
      </div>

      {/* Hébergeur DNS : déduit des serveurs de noms autoritatifs du domaine. */}
      <div className="mt-3 p-3 rounded-md bg-secondary-50 border border-secondary-200">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-secondary-900">
            <i className="ri-server-line"></i>
            Hébergeur DNS détecté : {dns.hebergeur}
          </span>
          {cloudflare && (
            <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-primary-100 text-primary-700 text-[10px] font-bold whitespace-nowrap">
              CNAME en « DNS only » obligatoire
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] text-foreground-600 break-all">
          {dns.serveursNoms.length > 0 ? (
            <>
              Serveurs de noms : <span className="font-mono">{dns.serveursNoms.join(", ")}</span>
            </>
          ) : (
            "Les serveurs de noms n'ont pas pu être lus pour le moment."
          )}
        </p>
        <p className="mt-1 text-[11px] text-foreground-500">
          C'est dans l'interface de cet hébergeur que se collent les enregistrements ci-dessous. Les libellés exacts des
          champs (« Nom », « Hôte », « Valeur », « Cible ») dépendent de lui.
        </p>
      </div>

      {/* Doublons SPF / DMARC et manques bloquants : avertissement explicite. */}
      {avertissements.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {avertissements.map((a) => {
            const doublon = /Doublon/i.test(a);
            return (
              <li
                key={a.slice(0, 40)}
                className={`p-3 rounded-md border text-[11px] leading-relaxed flex items-start gap-2 ${
                  doublon
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-primary-50 border-primary-200 text-primary-800"
                }`}
              >
                <i
                  className={`shrink-0 mt-0.5 ${doublon ? "ri-forbid-line" : "ri-error-warning-line"}`}
                ></i>
                <span>{a}</span>
              </li>
            );
          })}
        </ul>
      )}

      <ul className="mt-3 flex flex-col gap-2">
        {dns.enregistrements.map((e) => (
          <Ligne key={e.cle} enregistrement={e} />
        ))}
      </ul>

      {dns.dmarc.doublon && (
        <p className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-1.5">
          <i className="ri-error-warning-line mt-0.5 shrink-0"></i>
          <span>
            Deux politiques DMARC simultanées rendent la validation impossible : gardez un seul enregistrement TXT sur{" "}
            <span className="font-mono">_dmarc</span>, en fusionnant les adresses de rapport dans le champ{" "}
            <span className="font-mono">rua=</span>.
          </span>
        </p>
      )}

      {dns.spf.doublon && (
        <p className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-1.5">
          <i className="ri-error-warning-line mt-0.5 shrink-0"></i>
          <span>
            Plusieurs enregistrements SPF existent à la racine : le SPF est cassé. Gardez-en un seul et fusionnez les
            mécanismes (<span className="font-mono">include:amazonses.com</span> notamment) à l'intérieur.
          </span>
        </p>
      )}
    </div>
  );
}