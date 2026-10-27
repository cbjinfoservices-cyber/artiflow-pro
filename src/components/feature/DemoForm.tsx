import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { DemoPrefill } from "@/hooks/useDemoModal";
import { envoyerFormulaire } from "@/lib/formulaires";

const metiersOptions = [
  "Plombier chauffagiste",
  "Électricien",
  "Maçon",
  "Peintre / finitions",
  "Menuisier",
  "Carreleur",
  "Couvreur",
  "Plaquiste / plâtrier",
  "Installateur photovoltaïque",
  "Autre métier du bâtiment",
];

type DemoFormProps = {
  idPrefix: string;
  source?: string;
  prefill?: DemoPrefill;
};

export default function DemoForm({ idPrefix, source, prefill }: DemoFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [formError, setFormError] = useState("");

  const id = (name: string) => `${idPrefix}-${name}`;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const honeypot = ((formData.get("website_alt") as string) || "").trim();
    if (honeypot) {
      setStatus("success");
      form.reset();
      return;
    }

    const extras: Record<string, string> = source ? { source } : {};

    setStatus("loading");
    setFormError("");

    const erreur = await envoyerFormulaire("demo", formData, extras);
    if (erreur) {
      setStatus("error");
      setFormError(erreur);
    } else {
      setStatus("success");
      form.reset();
    }
  };

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center text-center py-10 animate-fade-in">
        <span className="w-16 h-16 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-3xl mb-5">
          <i className="ri-checkbox-circle-line"></i>
        </span>
        <h3 className="font-heading font-bold text-2xl text-foreground-950">Demande envoyée !</h3>
        <p className="mt-3 text-sm text-foreground-600 max-w-sm">
          Merci, on vous rappelle très vite pour caler votre démonstration ArtiFlow-pro.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-6 inline-flex items-center gap-2 h-10 px-5 rounded-md bg-background-100 border border-background-200 text-sm font-semibold text-foreground-800 cursor-pointer hover:bg-background-200 transition-colors"
        >
          <i className="ri-arrow-left-line"></i>
          Envoyer une autre demande
        </button>
      </div>
    );
  }

  return (
    <form
      id={`${idPrefix}-demo-form`}
      data-readdy-form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("name")} className="text-xs font-semibold text-foreground-700">
            Nom & prénom
          </label>
          <input
            id={id("name")}
            name="nom"
            type="text"
            required
            placeholder="Karim Benali"
            className="h-11 px-3.5 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-900 placeholder:text-foreground-400 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("metier")} className="text-xs font-semibold text-foreground-700">
            Votre métier
          </label>
          <select
            id={id("metier")}
            name="metier"
            required
            defaultValue=""
            className="h-11 px-3.5 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors cursor-pointer"
          >
            <option value="" disabled>
              Choisir…
            </option>
            {metiersOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("email")} className="text-xs font-semibold text-foreground-700">
            Email
          </label>
          <input
            id={id("email")}
            name="email"
            type="email"
            required
            placeholder="vous@entreprise.fr"
            className="h-11 px-3.5 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-900 placeholder:text-foreground-400 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("tel")} className="text-xs font-semibold text-foreground-700">
            Téléphone
          </label>
          <input
            id={id("tel")}
            name="telephone"
            type="tel"
            placeholder="06 12 34 56 78"
            className="h-11 px-3.5 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-900 placeholder:text-foreground-400 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors"
          />
        </div>
      </div>

      {typeof prefill?.users === "number" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("utilisateurs")} className="text-xs font-semibold text-foreground-700">
            Nombre d'utilisateurs de votre équipe
          </label>
          <input
            id={id("utilisateurs")}
            name="utilisateurs"
            type="number"
            min={1}
            max={200}
            defaultValue={prefill.users}
            className="h-11 px-3.5 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors"
          />
          <p className="text-[11px] text-foreground-400">
            Pré-rempli pour vous, vous pouvez l'ajuster si besoin.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={id("message")} className="text-xs font-semibold text-foreground-700">
          Votre besoin (optionnel)
        </label>
        <textarea
          id={id("message")}
          name="message"
          rows={4}
          maxLength={500}
          defaultValue={
            typeof prefill?.users === "number"
              ? `Nous sommes ${prefill.users} artisans et souhaitons un devis pour l'offre Entreprise.`
              : undefined
          }
          placeholder="Ex : je fais surtout des devis de plomberie et j'aimerais arrêter de les rédiger le soir…"
          className="px-3.5 py-2.5 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-900 placeholder:text-foreground-400 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors resize-none"
        ></textarea>
      </div>

      <input
        className="form-anti-bot-check"
        type="text"
        name="website_alt"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        readOnly
      />

      {status === "error" && (
        <p className="text-xs text-primary-700 bg-primary-50 border border-primary-200 rounded-md px-3.5 py-2.5">{formError}</p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-1 inline-flex items-center justify-center gap-2 h-12 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {status === "loading" ? (
          <>
            <i className="ri-loader-4-line animate-spin"></i>
            Envoi en cours…
          </>
        ) : (
          <>
            <i className="ri-calendar-check-line"></i>
            Demander ma démo
          </>
        )}
      </button>
      <p className="text-center text-[11px] text-foreground-400">
        En envoyant ce formulaire, vous acceptez d'être recontacté au sujet d'ArtiFlow-pro. Vos données sont
        traitées conformément à notre{" "}
        <Link to="/rgpd" className="font-semibold text-primary-700 hover:underline cursor-pointer">
          politique de confidentialité (RGPD)
        </Link>
        .
      </p>
    </form>
  );
}