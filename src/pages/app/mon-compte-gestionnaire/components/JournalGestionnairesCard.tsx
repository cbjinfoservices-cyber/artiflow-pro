import { useMemo, useState } from "react";
import type { Gestionnaire, JournalGestionnaire } from "@/hooks/useAuth";
import { LoadingBlock } from "@/pages/app/components/DataState";
import { downloadCsv, toCsv } from "@/lib/csv";
import { todayISO } from "@/lib/dates";
import { normaliseEmail } from "@/lib/roles";
import RechercheRepliable from "@/components/feature/RechercheRepliable";

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${heure}`;
}

const ACTION_META: Record<string, { icon: string; label: string; tone: string; verbo: string }> = {
  ajout: { icon: "ri-user-add-line", label: "Ajout", tone: "bg-accent-100 text-accent-800", verbo: "a ajouté" },
  retrait: {
    icon: "ri-user-unfollow-line",
    label: "Retrait",
    tone: "bg-red-100 text-red-700",
    verbo: "a retiré",
  },
  modification: {
    icon: "ri-edit-line",
    label: "Modification",
    tone: "bg-secondary-100 text-secondary-800",
    verbo: "a modifié",
  },
};

type FiltreNature = "tous" | "ajout" | "modification" | "retrait";

const NATURES: { value: FiltreNature; label: string; icon: string }[] = [
  { value: "tous", label: "Tous", icon: "ri-list-check" },
  { value: "ajout", label: "Ajout", icon: "ri-user-add-line" },
  { value: "modification", label: "Modification", icon: "ri-edit-line" },
  { value: "retrait", label: "Retrait", icon: "ri-user-unfollow-line" },
];

/**
 * Journal des modifications de la liste des gestionnaires : qui a ajouté, modifié ou retiré
 * quelle adresse, et quand. La journalisation est automatique côté Backend (déclencheur) :
 * ce composant ne fait que l'afficher, filtrer (nature, auteur, période, recherche libre) et
 * exporter en CSV, du plus récent au plus ancien.
 */
export default function JournalGestionnairesCard({
  items,
  gestionnaires,
  loading,
  onReload,
}: {
  items: JournalGestionnaire[];
  gestionnaires: Gestionnaire[];
  loading: boolean;
  onReload: () => void;
}) {
  const [filtreNature, setFiltreNature] = useState<FiltreNature>("tous");
  const [filtreAuteur, setFiltreAuteur] = useState<string>("tous");
  const [dateDebut, setDateDebut] = useState<string>("");
  const [dateFin, setDateFin] = useState<string>("");
  const [recherche, setRecherche] = useState<string>("");

  const auteurs = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.acteur_email ?? "Système"));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Libellé + note actuels, indexés par adresse, pour enrichir l'affichage et l'export CSV.
  const infosParEmail = useMemo(() => {
    const map = new Map<string, Gestionnaire>();
    gestionnaires.forEach((g) => map.set(normaliseEmail(g.email), g));
    return map;
  }, [gestionnaires]);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const debut = dateDebut ? new Date(`${dateDebut}T00:00:00`).getTime() : null;
    const fin = dateFin ? new Date(`${dateFin}T23:59:59.999`).getTime() : null;
    return items.filter((i) => {
      if (filtreNature !== "tous" && i.action !== filtreNature) return false;
      if (filtreAuteur !== "tous" && (i.acteur_email ?? "Système") !== filtreAuteur) return false;
      const ts = new Date(i.created_at).getTime();
      if (debut !== null && ts < debut) return false;
      if (fin !== null && ts > fin) return false;
      if (q) {
        const dansAdresse = i.email.toLowerCase().includes(q);
        const dansDetail = (i.detail ?? "").toLowerCase().includes(q);
        if (!dansAdresse && !dansDetail) return false;
      }
      return true;
    });
  }, [items, filtreNature, filtreAuteur, dateDebut, dateFin, recherche]);

  const filtreActif =
    filtreNature !== "tous" ||
    filtreAuteur !== "tous" ||
    dateDebut !== "" ||
    dateFin !== "" ||
    recherche.trim() !== "";

  const reinitialiser = () => {
    setFiltreNature("tous");
    setFiltreAuteur("tous");
    setDateDebut("");
    setDateFin("");
    setRecherche("");
  };

  const exporterCsv = () => {
    const contenu = toCsv(
      ["Date", "Nature", "Adresse", "Libellé", "Note interne", "Détail", "Auteur"],
      filtres.map((e) => {
        const info = infosParEmail.get(normaliseEmail(e.email));
        return [
          formatDateTime(e.created_at),
          ACTION_META[e.action]?.label ?? e.action,
          e.email,
          info?.libelle ?? "",
          info?.note ?? "",
          e.detail ?? "",
          e.acteur_email ?? "Système",
        ];
      }),
    );
    const suffixe = filtreActif ? "filtre" : "complet";
    downloadCsv(`journal-gestionnaires-${suffixe}-${todayISO()}.csv`, contenu);
  };

  return (
    <div className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-background-200/50">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
            <i className="ri-history-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-bold text-sm text-foreground-950">Journal des modifications</h3>
            <p className="text-[11px] text-foreground-500">
              Qui a ajouté, modifié ou retiré une adresse gestionnaire, et quand
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exporterCsv}
            disabled={filtres.length === 0}
            title={filtreActif ? "Exporter le journal filtré (CSV)" : "Exporter tout le journal (CSV)"}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-100 text-primary-800 border border-primary-200 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-download-2-line"></i>
            Exporter CSV
          </button>
          <button
            type="button"
            onClick={onReload}
            disabled={loading}
            title="Recharger le journal depuis le Backend"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className={`ri-refresh-line ${loading ? "animate-spin" : ""}`}></i>
            Actualiser
          </button>
        </div>
      </div>

      {/* Barre de filtres : nature, recherche libre, auteur, période */}
      {items.length > 0 && (
        <div className="flex flex-col gap-3 px-5 py-3 border-t border-background-200 bg-background-50">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 p-1 rounded-full bg-background-200/70">
              {NATURES.map((n) => (
                <button
                  key={n.value}
                  type="button"
                  onClick={() => setFiltreNature(n.value)}
                  className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    filtreNature === n.value
                      ? "bg-background-50 text-foreground-950"
                      : "text-foreground-500 hover:text-foreground-800"
                  }`}
                >
                  <i className={`${n.icon} text-xs`}></i>
                  {n.label}
                </button>
              ))}
            </div>

            <RechercheRepliable
              carteId="journal-gestionnaires"
              carteLabel="Journal des gestionnaires"
              value={recherche}
              onChange={setRecherche}
              placeholder="Rechercher une adresse ou un détail…"
              compact
              conteneurClassName="w-[220px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 h-8 rounded-md bg-background-50 border border-background-200 focus-within:border-primary-400">
              <i className="ri-user-line text-foreground-400 text-xs"></i>
              <select
                value={filtreAuteur}
                onChange={(e) => setFiltreAuteur(e.target.value)}
                className="bg-transparent text-xs text-foreground-800 outline-none cursor-pointer max-w-[180px]"
              >
                <option value="tous">Tous les auteurs</option>
                {auteurs.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-foreground-500">Du</span>
              <input
                type="date"
                value={dateDebut}
                max={dateFin || undefined}
                onChange={(e) => setDateDebut(e.target.value)}
                className="h-8 px-2 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-800 outline-none cursor-pointer focus:border-primary-400"
              />
              <span className="text-[11px] text-foreground-500">au</span>
              <input
                type="date"
                value={dateFin}
                min={dateDebut || undefined}
                onChange={(e) => setDateFin(e.target.value)}
                className="h-8 px-2 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-800 outline-none cursor-pointer focus:border-primary-400"
              />
            </div>

            <span className="text-[11px] text-foreground-500">
              {filtres.length} entrée{filtres.length > 1 ? "s" : ""}
              {filtreActif ? ` sur ${items.length}` : ""}
            </span>

            {filtreActif && (
              <button
                type="button"
                onClick={reinitialiser}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-700 hover:text-primary-800 cursor-pointer transition-colors"
              >
                <i className="ri-close-circle-line"></i>
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      )}

      {loading && items.length === 0 ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <p className="p-8 text-center text-sm text-foreground-500">
          Aucune modification enregistrée pour l'instant. Les prochains ajouts, modifications ou retraits apparaîtront ici.
        </p>
      ) : filtres.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-foreground-500">Aucune entrée ne correspond à ces filtres.</p>
          <button
            type="button"
            onClick={reinitialiser}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:text-primary-800 cursor-pointer transition-colors"
          >
            <i className="ri-close-circle-line"></i>
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        filtres.map((entry) => {
          const meta = ACTION_META[entry.action] ?? {
            icon: "ri-edit-line",
            label: "Modification",
            tone: "bg-background-200 text-foreground-600",
            verbo: "a modifié",
          };
          const info = infosParEmail.get(normaliseEmail(entry.email));
          return (
            <div
              key={entry.id}
              className="flex items-start gap-3 px-5 py-3 border-t border-background-200 hover:bg-background-50 transition-colors"
            >
              <span className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-lg ${meta.tone}`}>
                <i className={`${meta.icon} text-sm`}></i>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-foreground-800">
                  <strong className="font-semibold text-foreground-950">{entry.acteur_email ?? "Système"}</strong>{" "}
                  {meta.verbo}{" "}
                  <strong className="font-semibold text-foreground-950 break-all">{entry.email}</strong>
                  {info?.libelle && (
                    <span className="ml-1.5 inline-flex items-center h-5 px-2 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-semibold align-middle">
                      {info.libelle}
                    </span>
                  )}
                </p>
                {entry.detail && <p className="text-[11px] text-foreground-500 mt-0.5 break-words">{entry.detail}</p>}
                <p className="inline-flex items-center gap-1 text-[10px] text-foreground-400 mt-0.5">
                  <i className="ri-time-line text-[10px]"></i>
                  {formatDateTime(entry.created_at)}
                </p>
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1 h-5 px-2 rounded-full ${meta.tone} text-[10px] font-bold whitespace-nowrap`}>
                {meta.label}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}