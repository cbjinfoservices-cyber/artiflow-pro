import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { envoyerFormulaire } from "@/lib/formulaires";

const SUJET_INTERVENTIONS = "Interventions près de chez moi";

const sujetsOptions = [
  "Question sur les offres et tarifs",
  "Assistance technique",
  "Demande de démonstration",
  SUJET_INTERVENTIONS,
  "Partenariat",
  "Autre demande",
];

const MESSAGE_TEMPLATES: Record<string, string> = {
  tarifs:
    "Bonjour,\n\nJe souhaite des précisions sur les offres et les tarifs d'ArtiFlow-pro : quelle formule convient le mieux à mon activité, et que comprend exactement chaque offre ?\n\nMerci d'avance pour votre retour.",
  "recap-annuel":
    "Bonjour,\n\nJ'ai une question sur la facturation annuelle : pouvez-vous m'expliquer l'économie des 2 mois offerts et les conditions d'engagement ?\n\nMerci d'avance pour votre retour.",
};

const ORIGINE_LABELS: Record<string, string> = {
  tarifs: "Page Tarifs",
  "recap-annuel": "Récap annuel",
};

export default function ContactForm() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [formError, setFormError] = useState("");
  const [sujet, setSujet] = useState(() => {
    const fromUrl = searchParams.get("sujet") || "";
    return sujetsOptions.includes(fromUrl) ? fromUrl : "";
  });
  const [message, setMessage] = useState(() => {
    const ville = (searchParams.get("ville") || "").trim();
    if (ville) {
      return `Bonjour,\n\nJe souhaite être alerté des interventions publiques d'ArtiFlow-pro près de chez moi (${ville}). Pouvez-vous me prévenir dès qu'une conférence, une table ronde ou un webinaire est organisé à ${ville} ou dans les environs ?\n\nMerci d'avance pour votre retour.`;
    }
    if ((searchParams.get("sujet") || "") === SUJET_INTERVENTIONS) {
      return "Bonjour,\n\nJe souhaite être alerté des interventions publiques d'ArtiFlow-pro près de chez moi. Pouvez-vous me prévenir dès qu'un événement est organisé dans ma région ?\n\nMerci d'avance pour votre retour.";
    }
    const origine = searchParams.get("origine") || "";
    return MESSAGE_TEMPLATES[origine] || "";
  });

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

    const origine = searchParams.get("origine") || "";
    const extras: Record<string, string> = { source: "page-contact" };
    if (origine) extras.origine = ORIGINE_LABELS[origine] || origine;

    setStatus("loading");
    setFormError("");

    const erreur = await envoyerFormulaire("contact", formData, extras);
    if (erreur) {
      setStatus("error");
      setFormError(erreur);
    } else {
      setStatus("success");
      form.reset();
      setSujet("");
      setMessage("");
    }
  };

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12 animate-fade-in">
        <span className="w-16 h-16 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-3xl mb-5">
          <i className="ri-checkbox-circle-line"></i>
        </span>
        <h3 className="font-heading font-bold text-2xl text-foreground-950">Message envoyé !</h3>
        <p className="mt-3 text-sm text-foreground-600 max-w-sm">
          Merci de nous avoir écrit. Notre équipe vous répond sous 24 heures ouvrées.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-6 inline-flex items-center gap-2 h-10 px-5 rounded-md bg-background-100 border border-background-200 text-sm font-semibold text-foreground-800 cursor-pointer hover:bg-background-200 transition-colors"
        >
          <i className="ri-arrow-left-line"></i>
          Envoyer un autre message
        </button>
      </div>
    );
  }

  const inputCls =
    "h-11 px-3.5 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-900 placeholder:text-foreground-400 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors";

  return (
    <form
      id="contact-form"
      data-readdy-form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-nom" className="text-xs font-semibold text-foreground-700">
            Nom & prénom
          </label>
          <input
            id="contact-nom"
            name="nom"
            type="text"
            required
            placeholder="Karim Benali"
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-societe" className="text-xs font-semibold text-foreground-700">
            Entreprise (optionnel)
          </label>
          <input
            id="contact-societe"
            name="entreprise"
            type="text"
            placeholder="Plomberie Benali"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-email" className="text-xs font-semibold text-foreground-700">
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            placeholder="vous@entreprise.fr"
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-tel" className="text-xs font-semibold text-foreground-700">
            Téléphone (optionnel)
          </label>
          <input
            id="contact-tel"
            name="telephone"
            type="tel"
            placeholder="06 12 34 56 78"
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-sujet" className="text-xs font-semibold text-foreground-700">
          Sujet
        </label>
        <select
          id="contact-sujet"
          name="sujet"
          required
          value={sujet}
          onChange={(event) => setSujet(event.target.value)}
          className="h-11 px-3.5 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors cursor-pointer"
        >
          <option value="" disabled>
            Choisir un sujet…
          </option>
          {sujetsOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-message" className="text-xs font-semibold text-foreground-700">
          Votre message
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          required
          maxLength={500}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Décrivez votre besoin en quelques lignes…"
          className="px-3.5 py-2.5 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-900 placeholder:text-foreground-400 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors resize-none"
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
        <p className="text-xs text-primary-700 bg-primary-50 border border-primary-200 rounded-md px-3.5 py-2.5">
          {formError}
        </p>
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
            <i className="ri-send-plane-line"></i>
            Envoyer mon message
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