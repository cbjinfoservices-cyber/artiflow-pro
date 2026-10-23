import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useRobotsMeta } from "@/hooks/useRobotsMeta";
import { normalizeChantierStatut } from "@/lib/statuts";
import { formatEuros } from "@/lib/format";
import { chargerSuiviChantier, type SuiviPublicData } from "@/lib/suiviChantier";

function dateLongue(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

const TONS: Record<string, string> = {
  "En cours": "bg-primary-100 text-primary-800",
  Terminé: "bg-accent-100 text-accent-800",
  Planifié: "bg-secondary-100 text-secondary-800",
};

export default function SuiviChantierPage() {
  usePageMeta("Suivi de chantier · ArtiFlow-pro", "Consultez l'avancement de votre chantier, étape par étape.");
  useRobotsMeta("noindex, nofollow");

  const { token = "" } = useParams();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<SuiviPublicData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const d = await chargerSuiviChantier(token);
      setData(d);
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ce lien de suivi n'est pas valide.");
      setState("error");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const accent = data?.artisan.accent ?? "#C4783A";
  const statut = data ? normalizeChantierStatut(data.chantier.statut) : "Planifié";
  const progression = data?.progression ?? 0;
  const telephone = data?.artisan.telephone ?? "";
  const email = data?.artisan.email ?? "";

  return (
    <div className="min-h-screen bg-background-50">
      <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />

      <header className="h-16 flex items-center px-4 md:px-6 border-b border-background-200">
        <div className="flex items-center gap-2.5 min-w-0">
          {data?.artisan.logoUrl ? (
            <span className="w-9 h-9 shrink-0 rounded-lg bg-background-100 border border-background-200 flex items-center justify-center overflow-hidden">
              <img
                src={data.artisan.logoUrl}
                alt={data.artisan.entreprise}
                title={`${data.artisan.entreprise} · suivi de chantier`}
                className="w-full h-full object-contain"
              />
            </span>
          ) : (
            <span
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-background-50"
              style={{ backgroundColor: accent }}
            >
              <i className="ri-tools-fill text-base"></i>
            </span>
          )}
          <span className="font-heading font-bold text-base text-foreground-950 truncate">
            {data?.artisan.entreprise ?? "Suivi de chantier"}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
        {state === "loading" && (
          <div className="flex flex-col items-center gap-3 py-24">
            <i className="ri-loader-4-line animate-spin text-2xl text-primary-600"></i>
            <p className="text-sm text-foreground-500">Chargement du suivi…</p>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center text-center px-6 py-16 rounded-lg bg-background-100 border border-background-200">
            <span className="w-14 h-14 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700 text-2xl">
              <i className="ri-link-unlink"></i>
            </span>
            <h1 className="mt-4 font-heading font-bold text-xl text-foreground-950">Lien indisponible</h1>
            <p className="mt-2 text-sm text-foreground-500 max-w-md">{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-5 inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-refresh-line"></i>
              Réessayer
            </button>
          </div>
        )}

        {state === "ready" && data && (
          <div className="flex flex-col gap-5 animate-fade-in">
            <section className="p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                    Suivi de chantier
                  </p>
                  <h1 className="mt-1 font-heading font-bold text-2xl md:text-3xl text-foreground-950">
                    {data.chantier.libelle}
                  </h1>
                  {data.chantier.adresse && (
                    <p className="mt-1 text-sm text-foreground-600 inline-flex items-center gap-1.5">
                      <i className="ri-map-pin-line"></i>
                      {data.chantier.adresse}
                    </p>
                  )}
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-semibold whitespace-nowrap ${
                    TONS[statut] ?? TONS.Planifié
                  }`}
                >
                  <i className="ri-circle-fill text-[8px]"></i>
                  {statut}
                </span>
              </div>

              <div className="mt-5">
                <div className="flex items-end justify-between text-sm mb-2">
                  <span className="text-foreground-600">
                    Avancement · {data.etapesFaites} étape{data.etapesFaites > 1 ? "s" : ""} sur {data.etapes.length}
                  </span>
                  <span className="font-heading font-bold text-lg text-foreground-950">{progression} %</span>
                </div>
                <div className="h-2.5 rounded-full bg-background-200 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${progression}%`, backgroundColor: accent }}
                  />
                </div>
                <p className="mt-2 text-xs text-foreground-500 inline-flex items-center gap-1.5">
                  <i className="ri-history-line"></i>
                  Mis à jour le {dateLongue(data.chantier.majLe)}
                </p>
              </div>
            </section>

            {data.chantier.message && (
              <section className="p-5 rounded-lg bg-accent-50 border border-accent-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-7 h-7 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
                    <i className="ri-chat-quote-line text-sm"></i>
                  </span>
                  <p className="font-heading font-semibold text-sm text-foreground-950">
                    Message de {data.artisan.entreprise}
                  </p>
                </div>
                <p className="text-sm text-foreground-700 leading-relaxed whitespace-pre-line">{data.chantier.message}</p>
              </section>
            )}

            <section className="p-5 rounded-lg bg-background-100 border border-background-200">
              <h2 className="font-heading font-semibold text-base text-foreground-950 mb-4">Les étapes du chantier</h2>
              {data.etapes.length === 0 ? (
                <p className="py-6 text-center text-sm text-foreground-500">
                  Les étapes seront affichées dès qu'elles seront renseignées.
                </p>
              ) : (
                <ol className="relative">
                  {data.etapes.map((e, index) => (
                    <li key={e.id} className="relative pl-9 pb-5 last:pb-0">
                      {index < data.etapes.length - 1 && (
                        <span className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-background-200" aria-hidden="true" />
                      )}
                      <span
                        className={`absolute left-0 top-0.5 w-6 h-6 flex items-center justify-center rounded-full text-xs ${
                          e.fait ? "text-background-50" : "bg-background-200 text-foreground-400"
                        }`}
                        style={e.fait ? { backgroundColor: accent } : undefined}
                      >
                        <i className={e.fait ? "ri-check-line" : "ri-circle-line"}></i>
                      </span>
                      <p
                        className={`text-sm font-medium ${
                          e.fait ? "text-foreground-500 line-through" : "text-foreground-900"
                        }`}
                      >
                        {e.libelle}
                      </p>
                      {e.note && (
                        <p className="mt-1 text-xs text-foreground-600 leading-relaxed whitespace-pre-line">{e.note}</p>
                      )}
                      {e.photoUrl && (
                        <a
                          href={e.photoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block w-full max-w-xs h-32 rounded-md overflow-hidden border border-background-200 cursor-pointer"
                          title={`${e.libelle} · photo du chantier`}
                        >
                          <img
                            src={e.photoUrl}
                            alt={`${e.libelle} · photo du chantier`}
                            title={`${e.libelle} · photo du chantier`}
                            className="w-full h-full object-cover object-top"
                          />
                        </a>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-lg bg-background-100 border border-background-200">
                <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Début des travaux</p>
                <p className="mt-1 text-sm font-semibold text-foreground-950">{dateLongue(data.chantier.dateDebut)}</p>
              </div>
              <div className="p-4 rounded-lg bg-background-100 border border-background-200">
                <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Montant des travaux</p>
                <p className="mt-1 text-sm font-semibold text-foreground-950">{formatEuros(data.chantier.montant)}</p>
              </div>
              <div className="p-4 rounded-lg bg-background-100 border border-background-200">
                <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Interlocuteur</p>
                <p className="mt-1 text-sm font-semibold text-foreground-950 truncate">{data.artisan.entreprise}</p>
                {data.artisan.metier && <p className="text-xs text-foreground-500 truncate">{data.artisan.metier}</p>}
              </div>
            </section>

            {(telephone || email) && (
              <section className="p-5 rounded-lg bg-secondary-50 border border-secondary-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-heading font-semibold text-sm text-foreground-950">Une question sur le chantier ?</p>
                  <p className="text-xs text-foreground-600 mt-0.5">
                    Écrivez directement à {data.artisan.entreprise}, votre message arrivera dans sa boîte.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {telephone && (
                    <a
                      href={`tel:${telephone.replace(/\s+/g, "")}`}
                      className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-50 border border-secondary-300 text-secondary-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-100 transition-colors"
                    >
                      <i className="ri-phone-line"></i>
                      Appeler
                    </a>
                  )}
                  {email && (
                    <a
                      href={`mailto:${email}?subject=${encodeURIComponent(
                        `Question sur le chantier ${data.chantier.libelle}`,
                      )}`}
                      className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                    >
                      <i className="ri-mail-line"></i>
                      Écrire un message
                    </a>
                  )}
                </div>
              </section>
            )}

            <p className="text-center text-xs text-foreground-400">
              Ce lien de suivi est personnel. Partagez-le uniquement avec les personnes concernées par le chantier.
            </p>
            <p className="text-center text-xs text-foreground-500">
              Vous suivez plusieurs chantiers ?
              <Link to="/espace-client" className="ml-1 font-semibold text-primary-700 hover:text-primary-800 cursor-pointer">
                Retrouvez-les tous dans votre espace client
              </Link>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}