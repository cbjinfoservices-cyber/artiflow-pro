import type { ReactNode } from "react";

/**
 * Captures d'écran reconstituées de l'espace artisan, montrées sur la page d'annonce
 * du suivi des emails : vérification d'adresse, liste des emails réellement partis,
 * et renvois programmés dans la cloche. Aucune donnée personnelle réelle n'est affichée.
 */

function CadreCapture({
  numero,
  titre,
  legende,
  icon,
  children,
}: {
  numero: string;
  titre: string;
  legende: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <figure className="flex flex-col rounded-lg border border-background-200 bg-background-50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-background-100 border-b border-background-200">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-background-300" />
          <span className="w-2 h-2 rounded-full bg-background-300" />
          <span className="w-2 h-2 rounded-full bg-background-300" />
        </span>
        <span className="ml-1 inline-flex items-center gap-1.5 text-[10px] font-semibold text-foreground-500">
          <i className="ri-computer-line"></i>
          Espace artisan · Clients
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-foreground-400">
          <i className="ri-camera-line"></i>
          Capture {numero}
        </span>
      </div>

      <div className="p-4 flex-1">{children}</div>

      <figcaption className="px-4 pb-4">
        <p className="flex items-start gap-2 text-xs text-foreground-600 leading-relaxed">
          <i className={`${icon} mt-0.5 text-accent-600`}></i>
          <span>
            <span className="font-semibold text-foreground-900">{titre} — </span>
            {legende}
          </span>
        </p>
      </figcaption>
    </figure>
  );
}

function CaptureVerification() {
  return (
    <CadreCapture
      numero="1"
      titre="Vérifier l'adresse"
      legende="le contrôle attrape la faute de domaine et propose l'adresse corrigée, avant tout envoi."
      icon="ri-shield-check-line"
    >
      <div className="rounded-md border border-background-200 bg-background-100 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">Fiche client</p>
        <p className="text-xs font-semibold text-foreground-950">Karim Benali · Plomberie Benali</p>
      </div>

      <p className="mt-3 text-[10px] font-semibold text-foreground-500">Email</p>
      <div className="mt-1 flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 h-8 px-2.5 rounded-md border border-red-300 bg-background-50">
          <i className="ri-mail-line text-xs text-foreground-400"></i>
          <span className="text-[11px] text-foreground-900 truncate">k.benali@gmai.com</span>
        </div>
        <span className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-primary-500 text-background-50 text-[10px] font-semibold whitespace-nowrap">
          <i className="ri-shield-check-line"></i>
          Vérifier
        </span>
      </div>

      <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2.5">
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-red-700">
          <i className="ri-error-warning-line"></i>
          Adresse invalide
        </p>
        <p className="mt-1 text-[10px] text-red-700/90 leading-relaxed">
          Le domaine « gmai.com » ressemble à une faute de frappe.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-red-600 text-white text-[10px] font-semibold whitespace-nowrap">
            <i className="ri-magic-line"></i>
            Utiliser k.benali@gmail.com
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-700">
            <i className="ri-lock-line"></i>
            Renvoi bloqué
          </span>
        </div>
      </div>

      <p className="mt-2 text-[10px] text-foreground-500 leading-relaxed">
        Une fois l'adresse corrigée : « Adresse valide : format et domaine corrects ».
      </p>
    </CadreCapture>
  );
}

function CaptureEmailsPartis() {
  const envois = [
    { objet: "Suivi de chantier — semaine 42", dest: "k.benali@gmail.com", date: "21 oct. · 09:14" },
    { objet: "Devis D-2026-118 · salle de bain", dest: "contact@moreau-renov.fr", date: "19 oct. · 17:02" },
    { objet: "Relance devis D-2026-112", dest: "s.lefevre@orange.fr", date: "17 oct. · 08:30" },
  ];

  return (
    <CadreCapture
      numero="2"
      titre="Emails partis"
      legende="la liste datée des envois réellement acceptés, avec l'objet et le destinataire."
      icon="ri-mail-check-line"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-foreground-900">
          <i className="ri-send-plane-line text-accent-600"></i>
          Emails partis
        </p>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-bold whitespace-nowrap">
          14 au total
        </span>
      </div>

      <ul className="mt-2.5 flex flex-col divide-y divide-background-200 rounded-md border border-background-200 bg-background-100 overflow-hidden">
        {envois.map((e) => (
          <li key={e.objet} className="flex items-start gap-2 px-2.5 py-2">
            <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-[10px]">
              <i className="ri-check-line"></i>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-foreground-900 truncate">{e.objet}</p>
              <p className="text-[10px] text-foreground-500 truncate">{e.dest}</p>
            </div>
            <span className="text-[9px] text-foreground-400 whitespace-nowrap">{e.date}</span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[10px] text-foreground-500">Les 8 derniers envois · les plus anciens restent comptés</p>
    </CadreCapture>
  );
}

function CaptureRenvoisPrevue() {
  return (
    <CadreCapture
      numero="3"
      titre="Renvois prévus"
      legende="chaque relance programmée affiche son décompte, et s'annule ligne par ligne ou en groupe."
      icon="ri-time-line"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-foreground-900">
          <i className="ri-notification-3-line text-accent-600"></i>
          Renvois prévus
        </p>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-100 text-primary-800 text-[10px] font-bold whitespace-nowrap">
          1 programmé
        </span>
      </div>

      <div className="mt-2.5 rounded-md border border-background-200 bg-background-100 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-foreground-900 truncate">SARL Moreau Rénovation</p>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-500 text-background-50 text-[9px] font-bold whitespace-nowrap">
            <i className="ri-timer-line"></i>
            dans 3 h 12 min
          </span>
        </div>
        <p className="mt-0.5 text-[10px] text-foreground-500 truncate">contact@moreau-renov.fr</p>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-background-300 bg-background-50 text-foreground-700 text-[10px] font-semibold whitespace-nowrap">
            <i className="ri-calendar-line"></i>
            Demain à 14:32
          </span>
          <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-background-300 bg-background-50 text-foreground-700 text-[10px] font-semibold whitespace-nowrap">
            <i className="ri-close-line"></i>
            Annuler
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-foreground-500">
          <i className="ri-information-line"></i>
          Annulation auto si la fiche est corrigée
        </span>
        <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-red-100 text-red-700 text-[10px] font-semibold whitespace-nowrap">
          Tout annuler
        </span>
      </div>
    </CadreCapture>
  );
}

export default function CapturesSuiviEmails() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <CaptureVerification />
      <CaptureEmailsPartis />
      <CaptureRenvoisPrevue />
    </div>
  );
}