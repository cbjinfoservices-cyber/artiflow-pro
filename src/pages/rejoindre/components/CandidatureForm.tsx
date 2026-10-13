import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { postesOuverts } from "@/mocks/rejoindre";

const FORM_URL = "https://readdy.ai/api/form/db4efd9rqll58fj4o72g";

const postesOptions = ["Candidature spontanée", ...postesOuverts.map((p) => p.title)];

type CandidatureFormProps = {
  role?: string;
};

export default function CandidatureForm({ role = "" }: CandidatureFormProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [formError, setFormError] = useState("");
  const [poste, setPoste] = useState(role || "Candidature spontanée");

  useEffect(() => {
    if (role) setPoste(role);
  }, [role]);

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

    const params = new URLSearchParams();
    formData.forEach((value, key) => {
      if (key === "website_alt") return;
      params.append(key, value as string);
    });
    params.append("source", "page-nous-rejoindre");

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
        setPoste("Candidature spontanée");
      } else {
        setStatus("error");
        setFormError(
          serverMsg || "L'envoi n'a pas abouti. Vérifiez vos informations puis réessayez."
        );
      }
    } catch {
      setStatus("error");
      setFormError("Connexion impossible pour le moment. Réessayez dans un instant.");
    }
  };

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12 animate-fade-in">
        <span className="w-16 h-16 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-3xl mb-5">
          <i className="ri-checkbox-circle-line"></i>
        </span>
        <h3 className="font-heading font-bold text-2xl text-foreground-950">Candidature bien reçue !</h3>
        <p className="mt-3 text-sm text-foreground-600 max-w-sm">
          Merci de votre intérêt pour ArtiFlow-pro. Notre équipe revient vers vous sous 24 heures ouvrées.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-6 inline-flex items-center gap-2 h-10 px-5 rounded-md bg-background-100 border border-background-200 text-sm font-semibold text-foreground-800 cursor-pointer hover:bg-background-200 transition-colors"
        >
          <i className="ri-arrow-left-line"></i>
          Envoyer une autre candidature
        </button>
      </div>
    );
  }

  const inputCls =
    "h-11 px-3.5 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-900 placeholder:text-foreground-400 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors";

  return (
    <form
      id="candidature-form"
      data-readdy-form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cand-nom" className="text-xs font-semibold text-foreground-700">
            Nom & prénom
          </label>
          <input
            id="cand-nom"
            name="nom"
            type="text"
            required
            placeholder="Camille Dufour"
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cand-email" className="text-xs font-semibold text-foreground-700">
            Email
          </label>
          <input
            id="cand-email"
            name="email"
            type="email"
            required
            placeholder="vous@email.fr"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cand-tel" className="text-xs font-semibold text-foreground-700">
            Téléphone (optionnel)
          </label>
          <input
            id="cand-tel"
            name="telephone"
            type="tel"
            placeholder="06 12 34 56 78"
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cand-poste" className="text-xs font-semibold text-foreground-700">
            Poste visé
          </label>
          <select
            id="cand-poste"
            name="poste"
            required
            value={poste}
            onChange={(e) => setPoste(e.target.value)}
            className="h-11 px-3.5 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors cursor-pointer"
          >
            {postesOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cand-linkedin" className="text-xs font-semibold text-foreground-700">
          Lien LinkedIn ou portfolio (optionnel)
        </label>
        <input
          id="cand-linkedin"
          name="lien_profil"
          type="url"
          placeholder="https://www.linkedin.com/in/…"
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cand-message" className="text-xs font-semibold text-foreground-700">
          Pourquoi ArtiFlow-pro ? Ce qui vous motive
        </label>
        <textarea
          id="cand-message"
          name="message"
          rows={5}
          required
          maxLength={500}
          placeholder="Quelques lignes sur votre parcours et ce qui vous donne envie de rejoindre l'équipe…"
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
            Envoyer ma candidature
          </>
        )}
      </button>
      <p className="text-center text-[11px] text-foreground-400">
        En envoyant ce formulaire, vous acceptez que nous traitions votre candidature conformément à notre{" "}
        <Link to="/rgpd" className="font-semibold text-primary-700 hover:underline cursor-pointer">
          politique de confidentialité (RGPD)
        </Link>
        .
      </p>
    </form>
  );
}