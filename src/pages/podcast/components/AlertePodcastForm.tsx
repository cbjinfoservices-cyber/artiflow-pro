import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

const FORM_URL = "https://readdy.ai/api/form/db4f1iprqll58fj4o7c0";

const plateformes = [
  "Toutes les plateformes",
  "Spotify",
  "Apple Podcasts",
  "YouTube",
  "Flux RSS",
  "Autre",
];

type AlertePodcastFormProps = {
  /** Fond de la carte : clair (défaut) ou sombre pour les CTA. */
  variante?: "clair" | "sombre";
};

/**
 * Abonnement e-mail aux nouveaux épisodes de podcast : les auditeurs
 * reçoivent une alerte dès qu'une nouvelle prise de parole est publiée,
 * et peuvent indiquer leur plateforme d'écoute préférée.
 */
export default function AlertePodcastForm({ variante = "clair" }: AlertePodcastFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [formError, setFormError] = useState("");

  const sombre = variante === "sombre";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const honeypot = ((formData.get("contact_alt") as string) || "").trim();
    if (honeypot) {
      setStatus("success");
      form.reset();
      return;
    }

    const params = new URLSearchParams();
    formData.forEach((value, key) => {
      if (key === "contact_alt") return;
      params.append(key, value as string);
    });
    params.append("source", "alerte-podcast");

    setStatus("loading");
    setFormError("");

    try {
      const response = await fetch(FORM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      const responseText = await response.text();
      let parsed: {
        code?: string;
        message?: string;
        meta?: { message?: string; detail?: string };
      } | null = null;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        parsed = null;
      }

      const serverMsg =
        parsed?.meta?.message || parsed?.message || parsed?.meta?.detail || responseText || "";
      const succeeded = response.ok && parsed?.code === "OK";
      const isSpam = typeof serverMsg === "string" && serverMsg.toLowerCase().includes("spam");

      if (succeeded && !isSpam) {
        setStatus("success");
        form.reset();
      } else {
        setStatus("error");
        setFormError(
          serverMsg || "L'inscription n'a pas abouti. Vérifiez votre email puis réessayez."
        );
      }
    } catch {
      setStatus("error");
      setFormError("Connexion impossible pour le moment. Réessayez dans un instant.");
    }
  };

  if (status === "success") {
    return (
      <div
        className={`flex flex-col items-center justify-center text-center py-10 px-6 rounded-lg border animate-fade-in ${
          sombre ? "bg-background-50/10 border-background-50/30" : "bg-background-50 border-background-200"
        }`}
      >
        <span
          className={`w-14 h-14 flex items-center justify-center rounded-full text-2xl mb-4 ${
            sombre ? "bg-background-50/15 text-background-50" : "bg-accent-100 text-accent-700"
          }`}
        >
          <i className="ri-notification-3-line"></i>
        </span>
        <h3
          className={`font-heading font-bold text-xl ${sombre ? "text-background-50" : "text-foreground-950"}`}
        >
          Abonnement confirmé !
        </h3>
        <p className={`mt-2 text-sm max-w-sm ${sombre ? "text-background-200/85" : "text-foreground-600"}`}>
          Vous recevrez une alerte dès qu'un nouvel épisode est publié. Vous pouvez vous désabonner à tout
          moment depuis chaque email.
        </p>
      </div>
    );
  }

  const inputCls = sombre
    ? "h-12 px-4 rounded-md bg-background-50/10 border border-background-50/30 text-sm text-background-50 placeholder:text-background-200/60 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 transition-colors"
    : "h-12 px-4 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-900 placeholder:text-foreground-400 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors";

  return (
    <form
      id="alerte-podcast"
      data-readdy-form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
      noValidate
    >
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label htmlFor="alerte-podcast-email" className="sr-only">
            Votre adresse email
          </label>
          <input
            id="alerte-podcast-email"
            name="email"
            type="email"
            required
            placeholder="vous@votre-email.fr"
            className={`w-full ${inputCls}`}
          />
        </div>
        <div className="sm:w-56">
          <label htmlFor="alerte-podcast-plateforme" className="sr-only">
            Votre plateforme d'écoute
          </label>
          <select
            id="alerte-podcast-plateforme"
            name="plateforme"
            defaultValue="Toutes les plateformes"
            className={`w-full h-12 px-3.5 rounded-md text-sm outline-none transition-colors cursor-pointer ${
              sombre
                ? "bg-background-50/10 border border-background-50/30 text-background-50 focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30"
                : "bg-background-50 border border-background-200 text-foreground-900 focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            }`}
          >
            {plateformes.map((plateforme) => (
              <option
                key={plateforme}
                value={plateforme}
                className={sombre ? "text-foreground-950" : undefined}
              >
                {plateforme}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {status === "loading" ? (
            <>
              <i className="ri-loader-4-line animate-spin"></i>
              Inscription…
            </>
          ) : (
            <>
              <i className="ri-notification-3-line"></i>
              M'abonner
            </>
          )}
        </button>
      </div>

      <input
        className="form-anti-bot-check"
        type="text"
        name="contact_alt"
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

      <p className={`text-xs leading-relaxed ${sombre ? "text-background-200/70" : "text-foreground-400"}`}>
        Une alerte par nouvel épisode, pas de spam. Données traitées conformément à notre{" "}
        <Link
          to="/rgpd"
          className={`font-semibold hover:underline cursor-pointer ${
            sombre ? "text-background-50" : "text-primary-700"
          }`}
        >
          politique de confidentialité (RGPD)
        </Link>
        .
      </p>
    </form>
  );
}