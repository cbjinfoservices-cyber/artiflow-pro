import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useRobotsMeta } from "@/hooks/useRobotsMeta";
import { metierLabel } from "@/lib/metiers";
import { formatEuros } from "@/lib/format";
import { formatShortDate } from "@/lib/dates";
import { fetchPublicDevis, signPublicDevis, type PublicDevisData } from "@/lib/signature";
import SignaturePad from "@/components/base/SignaturePad";

export default function SignatureDevisPage() {
  usePageMeta("Signature du devis · ArtiFlow-pro", "Consultez et signez votre devis en ligne en toute sécurité.");
  useRobotsMeta("noindex, nofollow");

  const { token = "" } = useParams();
  const [state, setState] = useState<"loading" | "ready" | "signed" | "error">("loading");
  const [data, setData] = useState<PublicDevisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [sig, setSig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const d = await fetchPublicDevis(token);
      setData(d);
      setNom(d.client?.nom ?? "");
      setState(d.devis.signed_at ? "signed" : "ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lien invalide.");
      setState("error");
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSign = async () => {
    if (!sig) {
      setFormError("Merci de signer dans la zone avant de valider.");
      return;
    }
    setFormError(null);
    setBusy(true);
    try {
      await signPublicDevis(token, sig, nom.trim());
      setData((prev) =>
        prev
          ? {
              ...prev,
              devis: {
                ...prev.devis,
                signed_at: new Date().toISOString(),
                signataire_nom: nom.trim() || null,
                signature_image: sig,
                statut: "Signé",
              },
            }
          : prev,
      );
      setState("signed");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "La signature a échoué.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-50">
      <header className="h-16 flex items-center px-4 md:px-6 border-b border-background-200">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-500 text-background-50">
            <i className="ri-tools-fill text-lg"></i>
          </span>
          <span className="font-heading font-bold text-lg text-foreground-950">ArtiFlow-pro</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
        {state === "loading" && (
          <div className="flex flex-col items-center gap-3 py-24">
            <i className="ri-loader-4-line animate-spin text-2xl text-primary-600"></i>
            <p className="text-sm text-foreground-500">Chargement du devis…</p>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center text-center px-6 py-16 rounded-lg bg-background-100 border border-background-200">
            <span className="w-14 h-14 flex items-center justify-center rounded-full bg-primary-100 text-primary-700 text-2xl">
              <i className="ri-error-warning-line"></i>
            </span>
            <h1 className="mt-4 font-heading font-bold text-xl text-foreground-950">Lien indisponible</h1>
            <p className="mt-2 text-sm text-foreground-500 max-w-md">{error}</p>
          </div>
        )}

        {data && (state === "ready" || state === "signed") && (
          <div className="flex flex-col gap-5">
            {/* En-tête émetteur */}
            <div className="p-5 rounded-lg bg-background-100 border border-background-200">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  {data.emetteur?.logo_url ? (
                    <span className="w-14 h-14 shrink-0 rounded-md bg-background-50 border border-background-200 flex items-center justify-center overflow-hidden">
                      <img src={data.emetteur.logo_url} alt={data.emetteur.entreprise ?? "Logo"} className="w-full h-full object-contain" />
                    </span>
                  ) : (
                    <span className="w-14 h-14 shrink-0 rounded-md bg-primary-100 text-primary-700 flex items-center justify-center text-xl">
                      <i className="ri-tools-fill"></i>
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-lg text-foreground-950 truncate">
                      {data.emetteur?.entreprise || "Votre artisan"}
                    </p>
                    <p className="text-xs text-foreground-500 truncate">
                      {[metierLabel(data.emetteur?.metier), data.emetteur?.telephone].filter(Boolean).join(" · ")}
                    </p>
                    {data.emetteur?.email && (
                      <p className="text-xs text-foreground-500 truncate flex items-center gap-1.5">
                        <i className="ri-mail-line"></i>
                        <a href={`mailto:${data.emetteur.email}`} className="hover:text-foreground-800 cursor-pointer">
                          {data.emetteur.email}
                        </a>
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Devis</p>
                  <p className="font-heading font-bold text-foreground-950">{data.devis.numero}</p>
                  <p className="text-xs text-foreground-500">{formatShortDate(data.devis.created_at)}</p>
                </div>
              </div>
            </div>

            {/* Signé */}
            {state === "signed" && (
              <div className="p-5 rounded-lg bg-accent-50 border border-accent-200">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
                    <i className="ri-checkbox-circle-line"></i>
                  </span>
                  <p className="font-heading font-semibold text-foreground-950">Ce devis a bien été signé</p>
                </div>
                {data.devis.signature_image && (
                  <div className="mt-3 rounded-md bg-background-50 border border-background-200 p-2">
                    <img src={data.devis.signature_image} alt="Signature" className="h-20 object-contain" />
                  </div>
                )}
                <p className="mt-2 text-xs text-foreground-600">
                  Signé par <strong className="text-foreground-900">{data.devis.signataire_nom ?? "le client"}</strong> le{" "}
                  {formatShortDate(data.devis.signed_at)}
                </p>
              </div>
            )}

            {/* Infos client + objet */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-background-100 border border-background-200">
                <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide mb-1.5">Client</p>
                <p className="text-sm font-semibold text-foreground-950">{data.client?.nom ?? "—"}</p>
                {data.client?.adresse && <p className="text-xs text-foreground-500 mt-0.5">{data.client.adresse}</p>}
                {data.client?.telephone && <p className="text-xs text-foreground-500">{data.client.telephone}</p>}
              </div>
              <div className="p-4 rounded-lg bg-background-100 border border-background-200">
                <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide mb-1.5">Objet des travaux</p>
                <p className="text-sm text-foreground-800">{data.devis.objet ?? "—"}</p>
              </div>
            </div>

            {/* Lignes */}
            <div className="rounded-lg border border-background-200 overflow-hidden">
              <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide bg-background-200/50">
                <span className="col-span-6">Désignation</span>
                <span className="col-span-2 text-right">Qté</span>
                <span className="col-span-2 text-right">P.U.</span>
                <span className="col-span-2 text-right">Total</span>
              </div>
              {data.lignes.length === 0 ? (
                <p className="p-6 text-center text-sm text-foreground-500">Aucune ligne détaillée.</p>
              ) : (
                data.lignes.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 border-t border-background-200 text-sm">
                    <span className="col-span-12 sm:col-span-6 text-foreground-800">{l.designation}</span>
                    <span className="col-span-4 sm:col-span-2 sm:text-right text-foreground-600">
                      {l.quantite} {l.unite}
                    </span>
                    <span className="col-span-4 sm:col-span-2 sm:text-right text-foreground-600">
                      {formatEuros(Number(l.prix_unitaire))}
                    </span>
                    <span className="col-span-4 sm:col-span-2 sm:text-right font-semibold text-foreground-950">
                      {formatEuros(Number(l.quantite) * Number(l.prix_unitaire))}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-accent-50 border border-accent-200">
              <span className="text-sm font-medium text-foreground-700">Total du devis</span>
              <div className="text-right">
                <p className="font-heading font-bold text-lg text-foreground-950">{formatEuros(Number(data.devis.total_ht))} HT</p>
                <p className="text-xs text-foreground-500">{formatEuros(Number(data.devis.total_ttc))} TTC</p>
              </div>
            </div>

            {/* Zone de signature */}
            {state === "ready" && (
              <div className="p-5 rounded-lg bg-background-100 border border-background-200">
                <h2 className="font-heading font-semibold text-base text-foreground-950">Accepter et signer le devis</h2>
                <p className="text-xs text-foreground-500 mt-1 mb-4">
                  En signant ci-dessous, vous acceptez le devis {data.devis.numero}. Votre signature vaut bon pour accord.
                </p>
                <label className="flex flex-col gap-1.5 mb-4">
                  <span className="text-xs font-medium text-foreground-700">Votre nom</span>
                  <input
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    placeholder="Prénom et nom"
                    className="h-11 px-3 rounded-md bg-background-50 border border-background-200 text-sm outline-none focus:border-primary-400 max-w-sm"
                  />
                </label>
                <SignaturePad onChange={setSig} height={200} />
                {formError && (
                  <p className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
                    <i className="ri-error-warning-line"></i>
                    {formError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleSign}
                  disabled={busy}
                  className="mt-4 inline-flex items-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-quill-pen-line"></i>}
                  Accepter et signer
                </button>
              </div>
            )}

            {/* Mentions légales */}
            {(data.emetteur?.siret || data.emetteur?.tva || data.emetteur?.assurance) && (
              <div className="p-4 rounded-lg bg-background-100 border border-background-200 text-[11px] text-foreground-500 leading-relaxed">
                {data.emetteur?.siret && <p>SIRET : {data.emetteur.siret}</p>}
                {data.emetteur?.tva && <p>N° TVA intracommunautaire : {data.emetteur.tva}</p>}
                {data.emetteur?.assurance && <p>Assurance : {data.emetteur.assurance}</p>}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}