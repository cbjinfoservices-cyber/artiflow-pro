import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import type { ClientItem } from "@/hooks/useArtisanData";
import type { RelanceClientItem } from "@/lib/relancesClient";
import { toISODate } from "@/lib/dates";
import { toCsv, downloadCsv } from "@/lib/csv";
import { SEUILS_TAUX, SEUIL_TAUX_DEFAUT, lireSeuilTaux, ecrireSeuilTaux, SEUIL_TAUX_EVENT } from "@/lib/tauxSeuil";
import CompleterEmailsModal from "@/pages/app/components/CompleterEmailsModal";
import MotifClientsModal, { type MotifClientItem } from "@/pages/app/dashboard/components/MotifClientsModal";

interface Props {
  /** Relances client (programmées + traitées) : on ne regarde que les relances déjà traitées. */
  relances: RelanceClientItem[];
  /** Clients de l'artisan : sert au raccourci vers la complétion des emails manquants. */
  clients?: ClientItem[];
  /** Recharge les clients après un enregistrement d'adresse email. */
  onClientsChanged?: () => Promise<void> | void;
  /** Recharge les relances après les envois déclenchés depuis la fenêtre de complétion des emails. */
  onRelancesChanged?: () => Promise<void> | void;
}

/** Une relance est « en échec » quand son statut contient « échec ». */
function estEnEchec(statut: string): boolean {
  return /chec/i.test(statut);
}

/** Le motif correspond-il à un client sans adresse email ? (cause récurrente la plus fréquente) */
function motifSansEmail(motif: string): boolean {
  return /adresse email/i.test(motif) || /sans email/i.test(motif);
}

/** Fenêtre d'observation du taux de réussite (en jours). */
const FENETRE_JOURS = 30;

/** Nombre de semaines affichées dans la mini-courbe de tendance (13 semaines ≈ 3 mois). */
const N_SEMAINES = 13;

/** Seuils de notification proposés (taux hebdomadaire sous lequel on prévient). */
const SEUILS_NOTIF = SEUILS_TAUX;

/** Seuil de notification par défaut (taux hebdomadaire), modifiable directement depuis l'indicateur. */
const SEUIL_ALERTE_DEFAUT = SEUIL_TAUX_DEFAUT;

/** Nombre minimum d'envois pour que la notification soit pertinente (évite les faux positifs). */
const MIN_ENVOIS_NOTIF = 2;

/** Délai minimum entre deux notifications navigateur (garde-fou anti-spam). */
const NOTIF_COOLDOWN_MS = 12 * 3600 * 1000;

// Préférences persistées localement : activation des notifications + seuil + horodatage du dernier envoi.
const NOTIF_TAUX_KEY = "artiflow.taux.notifNavigateur";
const NOTIF_TAUX_SEEN_KEY = "artiflow.taux.dernierEnvoiNotif";

/** Mémorise le tri du classement des motifs choisi par l'utilisateur. */
const TRI_MOTIF_KEY = "artiflow.taux.triMotif";

interface Semaine {
  /** Libellé court de la semaine (ex. « 12 août »). */
  label: string;
  /** Premier jour de la semaine (ISO, YYYY-MM-DD) : sert au lien vers la liste filtrée. */
  debut: string;
  /** Taux de réussite de la semaine (0-100), ou null si aucun envoi traité cette semaine. */
  taux: number | null;
  ok: number;
  ko: number;
  /** Motif d'échec dominant de la semaine (le plus fréquent), ou chaîne vide. */
  motif: string;
  /** Nombre d'occurrences du motif dominant. */
  motifCount: number;
}

/** Motif d'échec enrichi de son impact sur la fiabilité globale. */
interface MotifImpact {
  motif: string;
  count: number;
  /** Part des envois de la période que ce motif fait échouer (%). */
  part: number;
  /** Points de taux récupérables si ce motif était corrigé. */
  gainPts: number;
}

/**
 * Indicateur « Taux de réussite des envois » : sur les 30 derniers jours, il compare le nombre
 * de relances client réellement envoyées à celles passées en échec. Il mesure la fiabilité des
 * envois d'un coup d'œil, classe les motifs d'échec selon leur impact sur le taux (avec le
 * « client sans email » mis en avant), affiche une mini-courbe hebdomadaire sur 3 mois
 * (exportable en CSV) et prévient par notification navigateur quand une semaine passe sous 50 %.
 */
export default function TauxReussiteEnvoi({
  relances,
  clients = [],
  onClientsChanged,
  onRelancesChanged,
}: Props) {
  const [showEmails, setShowEmails] = useState(false);
  // Motif d'échec dont on affiche l'aperçu détaillé des clients concernés (null = fermé).
  const [motifOuvert, setMotifOuvert] = useState<string | null>(null);
  // Tri du classement des motifs : par impact (défaut), par nom, ou par tendance 3 mois
  // (met en avant ceux qui reculent le moins, donc à surveiller en priorité).
  const [triMotif, setTriMotif] = useState<"impact" | "nom" | "tendance">(() => {
    const saved = localStorage.getItem(TRI_MOTIF_KEY);
    return saved === "nom" || saved === "tendance" ? saved : "impact";
  });
  // Filtre par tendance : ne montrer que les motifs qui reculent, montent ou stagnent sur 3 mois.
  const [filtreTendance, setFiltreTendance] = useState<"tous" | "recule" | "hausse" | "stable">("tous");
  const [notifNav, setNotifNav] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );
  // Seuil de notification réglable (au lieu du 50 % fixe) : on avertit quand le taux hebdo passe dessous.
  const [seuilAlerte, setSeuilAlerte] = useState<number>(SEUIL_ALERTE_DEFAUT);

  // Restaure l'activation des notifications navigateur et le seuil choisi au montage.
  useEffect(() => {
    const saved = localStorage.getItem(NOTIF_TAUX_KEY);
    if (saved !== null) setNotifNav(saved === "true");
    setSeuilAlerte(lireSeuilTaux());
    if (typeof Notification !== "undefined") setNotifPermission(Notification.permission);
  }, []);

  // Reste synchronisé si le seuil change ailleurs (autre onglet ouvert) : on relit la valeur partagée.
  useEffect(() => {
    const sync = () => setSeuilAlerte(lireSeuilTaux());
    window.addEventListener(SEUIL_TAUX_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SEUIL_TAUX_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const { reussies, echecs, total, taux, motifs, sansEmailCount } = useMemo(() => {
    const cutoff = Date.now() - FENETRE_JOURS * 86400000;
    const dansFenetre = relances.filter((r) => {
      if (r.statut === "Programmée") return false;
      const d = new Date(r.envoye_le ?? r.date_prevue);
      return !Number.isNaN(d.getTime()) && d.getTime() >= cutoff;
    });
    const ok = dansFenetre.filter((r) => r.statut === "Envoyée").length;
    const ko = dansFenetre.filter((r) => estEnEchec(r.statut));
    const tot = ok + ko.length;
    const tauxGlobal = tot > 0 ? Math.round((ok / tot) * 100) : null;

    // Répartition des motifs d'échec sur la période (du plus fréquent au moins fréquent),
    // enrichie de leur impact : part des envois concernés et points récupérables si corrigé.
    const map = new Map<string, number>();
    ko.forEach((r) => {
      const m = (r.motif_echec ?? "").trim();
      if (m) map.set(m, (map.get(m) ?? 0) + 1);
    });
    const motifsList: MotifImpact[] = Array.from(map.entries())
      .map(([motif, count]) => ({
        motif,
        count,
        part: tot > 0 ? Math.round((count / tot) * 100) : 0,
        gainPts: tot > 0 ? Math.max(0, Math.round(((ok + count) / tot) * 100) - (tauxGlobal ?? 0)) : 0,
      }))
      .sort((a, b) => b.gainPts - a.gainPts || b.count - a.count);
    const sansEmail = motifsList
      .filter((m) => motifSansEmail(m.motif))
      .reduce((sum, m) => sum + m.count, 0);

    return {
      reussies: ok,
      echecs: ko.length,
      total: tot,
      taux: tauxGlobal,
      motifs: motifsList,
      sansEmailCount: sansEmail,
    };
  }, [relances]);

  // Série hebdomadaire du taux de réussite sur ~3 mois (du plus ancien au plus récent).
  const semaines = useMemo<Semaine[]>(() => {
    const now = Date.now();
    const res: Semaine[] = [];
    for (let i = N_SEMAINES - 1; i >= 0; i--) {
      const fin = now - i * 7 * 86400000;
      const debut = fin - 7 * 86400000;
      const dedans = relances.filter((r) => {
        if (r.statut === "Programmée") return false;
        const d = new Date(r.envoye_le ?? r.date_prevue).getTime();
        return !Number.isNaN(d) && d > debut && d <= fin;
      });
      const ok = dedans.filter((r) => r.statut === "Envoyée").length;
      const koList = dedans.filter((r) => estEnEchec(r.statut));
      const tot = ok + koList.length;
      const label = new Date(debut).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

      // Motif d'échec dominant de la semaine (le plus fréquent) pour l'archive CSV.
      const koMap = new Map<string, number>();
      koList.forEach((r) => {
        const m = (r.motif_echec ?? "").trim();
        if (m) koMap.set(m, (koMap.get(m) ?? 0) + 1);
      });
      const top = Array.from(koMap.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;

      res.push({
        label,
        debut: toISODate(new Date(debut)),
        taux: tot > 0 ? Math.round((ok / tot) * 100) : null,
        ok,
        ko: koList.length,
        motif: top?.[0] ?? "",
        motifCount: top?.[1] ?? 0,
      });
    }
    return res;
  }, [relances]);

  // Navigation clavier des barres du mini-graphe de tendance (roving tabindex type « toolbar »),
  // calquée sur les mini-graphes de « Santé du compte » et des remplacements.
  const [barFocus, setBarFocus] = useState(() => {
    const i = semaines.findIndex((s) => s.taux !== null);
    return i >= 0 ? i : 0;
  });
  const barRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  // Survol du mini-graphe : affiche l'infobulle « barre au clavier » rappelant le raccourci Entrée.
  const [survolGraphe, setSurvolGraphe] = useState(false);

  // Série mensuelle (3 derniers mois) du nombre d'échecs par motif : sert à voir d'un seul regard
  // lequel recule vraiment. La série est du plus ancien au plus récent. On expose aussi les
  // libellés courts des mois pour l'en-tête de l'export CSV mensuel.
  const { motifsMonthly, moisLabels } = useMemo(() => {
    const now = new Date();
    const moisCle: string[] = [];
    const labels: string[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      moisCle.push(`${d.getFullYear()}-${d.getMonth()}`);
      labels.push(d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }));
    }
    const map = new Map<string, number[]>();
    relances.forEach((r) => {
      if (r.statut === "Programmée" || !estEnEchec(r.statut)) return;
      const m = (r.motif_echec ?? "").trim();
      if (!m) return;
      const d = new Date(r.envoye_le ?? r.date_prevue);
      if (Number.isNaN(d.getTime())) return;
      const idx = moisCle.indexOf(`${d.getFullYear()}-${d.getMonth()}`);
      if (idx === -1) return;
      const arr = map.get(m) ?? [0, 0, 0];
      arr[idx] += 1;
      map.set(m, arr);
    });
    return { motifsMonthly: map, moisLabels: labels };
  }, [relances]);

  // Série mensuelle globale (tous motifs confondus) : somme des échecs de tous les motifs
  // mois par mois, pour voir la tendance générale du volume d'échecs en haut du classement.
  const serieGlobaleMensuelle = useMemo(() => {
    const arr = new Array(moisLabels.length).fill(0) as number[];
    motifsMonthly.forEach((serie) => {
      serie.forEach((v, i) => {
        if (i < arr.length) arr[i] += v;
      });
    });
    return arr;
  }, [motifsMonthly, moisLabels]);

  // Variation globale sur les 3 mois (dernier − premier) : négatif = le volume d'échecs recule.
  const deltaGlobal =
    (serieGlobaleMensuelle[serieGlobaleMensuelle.length - 1] ?? 0) - (serieGlobaleMensuelle[0] ?? 0);

  // Variation d'un motif sur les 3 mois (dernier mois − premier mois) : négatif = recule (bon
  // signe), positif = repart à la hausse. Sert au tri « tendance » et à la colonne CSV.
  const deltaMotif = (m: string) => {
    const serie = motifsMonthly.get(m) ?? [0, 0, 0];
    return (serie[serie.length - 1] ?? 0) - (serie[0] ?? 0);
  };

  // Classement des motifs selon le tri choisi (par défaut, l'impact est déjà l'ordre de `motifs`).
  const motifsTries = useMemo(() => {
    let list = [...motifs];
    // Filtre par tendance : on ne garde que les motifs d'une même catégorie d'évolution 3 mois.
    if (filtreTendance !== "tous") {
      list = list.filter((m) => {
        const d = deltaMotif(m.motif);
        if (filtreTendance === "recule") return d < 0;
        if (filtreTendance === "hausse") return d > 0;
        return d === 0;
      });
    }
    if (triMotif === "nom") return list.sort((a, b) => a.motif.localeCompare(b.motif, "fr"));
    if (triMotif === "tendance") {
      // Ceux qui reculent le moins (variation la plus forte) apparaissent en premier.
      return list.sort((a, b) => deltaMotif(b.motif) - deltaMotif(a.motif) || b.count - a.count);
    }
    return list;
  }, [motifs, triMotif, motifsMonthly, filtreTendance]);

  // Motif au plus fort impact (tête du classement d'origine) : seul à porter le badge « Principal frein ».
  const principalMotif = motifs[0]?.motif ?? null;

  const semainesAvecDonnees = semaines.filter((s) => s.taux !== null);

  // Semaine glissante (7 derniers jours) : sert de base à la notification sous le seuil.
  const semaineGlissante = semaines[semaines.length - 1];

  // Tendance : taux de la dernière semaine renseignée comparé à la précédente.
  const tendance = useMemo(() => {
    if (semainesAvecDonnees.length < 2) return null;
    const derniere = semainesAvecDonnees[semainesAvecDonnees.length - 1];
    const avant = semainesAvecDonnees[semainesAvecDonnees.length - 2];
    return (derniere.taux ?? 0) - (avant.taux ?? 0);
  }, [semainesAvecDonnees]);

  // Notification navigateur : quand le taux de la semaine glissante chute sous 50 %.
  useEffect(() => {
    if (!notifNav) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const s = semaineGlissante;
    if (!s || s.taux === null || s.taux >= seuilAlerte || s.ok + s.ko < MIN_ENVOIS_NOTIF) return;
    const last = Number(localStorage.getItem(NOTIF_TAUX_SEEN_KEY));
    if (Number.isFinite(last) && last > 0 && Date.now() - last < NOTIF_COOLDOWN_MS) return;
    try {
      new Notification("ArtiFlow-pro · Taux de réussite en chute", {
        body: `Semaine du ${s.label} : ${s.taux}% de réussite (${s.ok} réussie${
          s.ok > 1 ? "s" : ""
        }, ${s.ko} en échec).${s.motif ? ` Motif principal : ${s.motif}.` : ""}`,
        tag: "artiflow-taux-semaine",
      });
      localStorage.setItem(NOTIF_TAUX_SEEN_KEY, String(Date.now()));
    } catch {
      /* certains navigateurs refusent la notification hors service worker */
    }
  }, [notifNav, semaineGlissante, seuilAlerte]);

  // Bascule la notification navigateur. Au premier clic, demande la permission au navigateur.
  const toggleNotifNav = async () => {
    if (typeof Notification === "undefined") return;
    if (notifNav) {
      setNotifNav(false);
      localStorage.setItem(NOTIF_TAUX_KEY, "false");
      return;
    }
    let perm = Notification.permission;
    if (perm === "default") {
      try {
        perm = await Notification.requestPermission();
      } catch {
        perm = "denied";
      }
    }
    setNotifPermission(perm);
    const enabled = perm === "granted";
    setNotifNav(enabled);
    localStorage.setItem(NOTIF_TAUX_KEY, String(enabled));
  };

  // Change le seuil de notification et le mémorise pour la prochaine visite.
  const changerSeuilAlerte = (value: number) => {
    setSeuilAlerte(value);
    ecrireSeuilTaux(value);
  };

  // Change le tri du classement des motifs et le mémorise pour la prochaine ouverture.
  const changerTriMotif = (value: "impact" | "nom" | "tendance") => {
    setTriMotif(value);
    localStorage.setItem(TRI_MOTIF_KEY, value);
  };

  // Export CSV du récap hebdomadaire : 13 semaines + motif d'échec dominant par semaine.
  const handleExportCsv = () => {
    const headers = [
      "Début de semaine (ISO)",
      "Semaine",
      "Réussies",
      "Échecs",
      "Taux de réussite (%)",
      "Motif d'échec dominant",
      "Occurrences du motif",
    ];
    const rows = semaines.map((s) => [
      s.debut,
      s.label,
      s.ok,
      s.ko,
      s.taux ?? "",
      s.motif || "—",
      s.motif ? s.motifCount : "",
    ]);
    downloadCsv(`taux-reussite-hebdo-${toISODate(new Date())}.csv`, toCsv(headers, rows));
  };

  // Export CSV du classement des motifs d'échec (occurrences + part + points récupérables) :
  // la colonne Période permet de comparer d'un mois sur l'autre quel frein recule.
  const handleExportMotifsCsv = () => {
    const debut = toISODate(new Date(Date.now() - FENETRE_JOURS * 86400000));
    const periode = `${debut} → ${toISODate(new Date())}`;
    const headers = ["Motif d'échec", "Occurrences", "Part des envois (%)", "Points récupérables", "Période (ISO)"];
    const rows = motifsTries.map((m) => [m.motif, m.count, m.part, m.gainPts, periode]);
    downloadCsv(`motifs-echec-${toISODate(new Date())}.csv`, toCsv(headers, rows));
  };

  // Export CSV de la ventilation mensuelle des motifs : une colonne par mois (3 derniers mois),
  // le total et la variation. Permet de suivre la tendance de chaque frein dans un tableur.
  const handleExportMensuelCsv = () => {
    const headers = [
      "Motif d'échec",
      ...moisLabels.map((l) => `Échecs ${l}`),
      "Total sur 3 mois",
      "Variation dernier − premier mois",
    ];
    const rows = motifsTries.map((m) => {
      const serie = motifsMonthly.get(m.motif) ?? [0, 0, 0];
      const total3 = serie.reduce((sum, v) => sum + v, 0);
      const delta = (serie[serie.length - 1] ?? 0) - (serie[0] ?? 0);
      return [m.motif, ...serie, total3, delta];
    });
    downloadCsv(`motifs-echec-mensuel-${toISODate(new Date())}.csv`, toCsv(headers, rows));
  };

  const partReussie = total > 0 ? (reussies / total) * 100 : 0;
  const tonTaux =
    taux === null ? "text-foreground-800" : taux >= 80 ? "text-accent-600" : taux >= 50 ? "text-foreground-800" : "text-red-600";

  const clientsSansEmail = useMemo(
    () => clients.filter((c) => !c.email || !c.email.trim()),
    [clients],
  );

  // Clients concernés par le motif ouvert dans l'aperçu détaillé (mêmes critères que le
  // classement : échecs des 30 derniers jours portant exactement ce motif).
  const motifOuvertItems = useMemo<MotifClientItem[]>(() => {
    if (!motifOuvert) return [];
    const cutoff = Date.now() - FENETRE_JOURS * 86400000;
    const parId = new Map(clients.map((c) => [c.id, c] as const));
    return relances
      .filter((r) => r.statut !== "Programmée" && estEnEchec(r.statut))
      .filter((r) => (r.motif_echec ?? "").trim() === motifOuvert)
      .filter((r) => {
        const d = new Date(r.envoye_le ?? r.date_prevue);
        return !Number.isNaN(d.getTime()) && d.getTime() >= cutoff;
      })
      .sort((a, b) => (b.envoye_le ?? b.date_prevue).localeCompare(a.envoye_le ?? a.date_prevue))
      .map((r) => {
        const c = parId.get(r.client_id);
        return {
          relanceId: r.id,
          clientId: r.client_id,
          nom: c?.nom ?? "Client",
          email: c?.email ?? null,
          envoyeLe: r.envoye_le,
          datePrevue: r.date_prevue,
          message: r.message,
        };
      });
  }, [motifOuvert, relances, clients]);

  // Couleur d'une barre de la mini-courbe selon la fiabilité de la semaine.
  const tonBarre = (t: number | null) => {
    if (t === null) return "bg-background-300";
    if (t >= 80) return "bg-accent-500";
    if (t >= 50) return "bg-secondary-500";
    return "bg-red-500";
  };

  // Couleur du badge d'impact selon le nombre de points récupérables.
  const tonGain = (gain: number) => {
    if (gain >= 10) return "bg-red-100 text-red-700";
    if (gain >= 4) return "bg-accent-100 text-accent-800";
    return "bg-secondary-100 text-secondary-800";
  };

  // Couleur de la mini-courbe d'un motif selon son évolution sur 3 mois :
  // vert s'il recule (bon signe), rouge s'il grossit, neutre s'il stagne.
  const tonSerieMotif = (serie: number[]) => {
    const premier = serie[0] ?? 0;
    const dernier = serie[serie.length - 1] ?? 0;
    if (dernier < premier) return "bg-accent-500";
    if (dernier > premier) return "bg-red-500";
    return dernier > 0 ? "bg-secondary-400" : "bg-background-300";
  };

  /** Déplace le focus clavier vers la barre voulue, en sautant les semaines sans envoi (inertes). */
  const focusBar = (depuis: number, dir: 1 | -1) => {
    const n = semaines.length;
    let cible = depuis + dir;
    while (cible >= 0 && cible < n && semaines[cible].taux === null) cible += dir;
    if (cible < 0 || cible >= n) return;
    setBarFocus(cible);
    barRefs.current[cible]?.focus();
  };

  /** Navigation clavier : flèches pour changer de semaine, Entrée (natif du lien) pour ouvrir. */
  const onBarKeyDown = (e: KeyboardEvent<HTMLAnchorElement>, index: number) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown": {
        e.preventDefault();
        focusBar(index, 1);
        break;
      }
      case "ArrowLeft":
      case "ArrowUp": {
        e.preventDefault();
        focusBar(index, -1);
        break;
      }
      case "Home": {
        e.preventDefault();
        const i0 = semaines.findIndex((s) => s.taux !== null);
        if (i0 >= 0) {
          setBarFocus(i0);
          barRefs.current[i0]?.focus();
        }
        break;
      }
      case "End": {
        e.preventDefault();
        let i1 = -1;
        for (let k = semaines.length - 1; k >= 0; k -= 1) {
          if (semaines[k].taux !== null) {
            i1 = k;
            break;
          }
        }
        if (i1 >= 0) {
          setBarFocus(i1);
          barRefs.current[i1]?.focus();
        }
        break;
      }
      default:
        break;
    }
  };

  return (
    <div className="p-4 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
            <i className="ri-flight-takeoff-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-950">Taux de réussite des envois</p>
            <p className="text-[11px] text-foreground-500">
              Relances client sur les {FENETRE_JOURS} derniers jours
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="inline-flex items-center gap-1 h-8 px-2 rounded-md bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-600 whitespace-nowrap">
            <i className="ri-alarm-warning-line"></i>
            <span className="text-foreground-400">Seuil</span>
            <select
              value={seuilAlerte}
              onChange={(e) => changerSeuilAlerte(Number(e.target.value))}
              title="Choisir le seuil de notification : on vous avertit quand le taux hebdomadaire passe en dessous"
              className="bg-transparent text-foreground-800 font-bold cursor-pointer outline-none"
            >
              {SEUILS_NOTIF.map((s) => (
                <option key={s} value={s}>
                  {s} %
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={toggleNotifNav}
            title={
              notifNav
                ? `Notifications navigateur activées : prévient si le taux passe sous ${seuilAlerte} % sur une semaine`
                : `Activer les notifications navigateur quand le taux passe sous ${seuilAlerte} % sur une semaine`
            }
            className={`w-8 h-8 flex items-center justify-center rounded-md border transition-colors cursor-pointer ${
              notifNav
                ? "bg-accent-100 border-accent-300 text-accent-700"
                : "bg-background-50 border-background-200 text-foreground-500 hover:bg-background-200"
            }`}
            aria-label="Activer ou couper les notifications navigateur du taux de réussite"
          >
            <i className={notifNav ? "ri-notification-3-fill" : "ri-notification-3-line"}></i>
          </button>
          {taux !== null && (
            <span className={`font-heading font-bold text-2xl ${tonTaux}`} title="Part des envois réussis">
              {taux}
              <span className="text-base">%</span>
            </span>
          )}
        </div>
      </div>

      {notifNav && notifPermission !== "granted" && (
        <p className="mt-2 text-[10px] text-red-600 flex items-center gap-1">
          <i className="ri-error-warning-line"></i>
          Notifications bloquées par le navigateur. Autorisez-les pour ce site pour les recevoir.
        </p>
      )}

      {total === 0 ? (
        <p className="mt-4 text-xs text-foreground-500">
          Aucune relance traitée sur cette période. Le taux s'affichera dès les premiers envois.
        </p>
      ) : (
        <>
          {/* Barre de répartition réussies / échecs */}
          <div className="mt-4 h-2.5 rounded-full bg-red-200 overflow-hidden flex">
            <div className="h-full bg-accent-500" style={{ width: `${partReussie}%` }}></div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-accent-500 shrink-0"></span>
              <div>
                <p className="text-sm font-bold text-foreground-950">{reussies}</p>
                <p className="text-[10px] uppercase tracking-wide text-foreground-500">Réussies</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0"></span>
              <div>
                <p className="text-sm font-bold text-foreground-950">{echecs}</p>
                <p className="text-[10px] uppercase tracking-wide text-foreground-500">En échec</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mini-courbe hebdomadaire : tendance du taux de réussite sur 3 mois */}
      {semainesAvecDonnees.length > 0 && (
        <div className="mt-4 pt-3 border-t border-background-200">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400 flex items-center gap-1.5">
              <i className="ri-line-chart-line"></i>
              Tendance · {N_SEMAINES} semaines
            </p>
            <div className="flex items-center gap-2">
              {tendance !== null && (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold whitespace-nowrap ${
                    tendance > 0 ? "text-accent-600" : tendance < 0 ? "text-red-600" : "text-foreground-500"
                  }`}
                  title="Évolution du taux par rapport à la semaine précédente"
                >
                  <i className={tendance > 0 ? "ri-arrow-up-line" : tendance < 0 ? "ri-arrow-down-line" : "ri-subtract-line"}></i>
                  {tendance > 0 ? "+" : ""}
                  {tendance} pts
                </span>
              )}
              <button
                type="button"
                onClick={handleExportCsv}
                title="Télécharger le récap hebdomadaire en CSV (13 semaines + motif dominant)"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-background-50 border border-background-200 text-foreground-600 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
              >
                <i className="ri-download-2-line"></i>
                CSV
              </button>
            </div>
          </div>

          <div
            className="relative mt-2 flex items-end justify-between gap-1 h-12"
            role="toolbar"
            onMouseEnter={() => setSurvolGraphe(true)}
            onMouseLeave={() => setSurvolGraphe(false)}
            aria-label="Évolution hebdomadaire du taux de réussite des envois : au clavier, déplacez-vous avec les flèches puis Entrée pour ouvrir une semaine"
          >
            {/* Infobulle « barre au clavier » : rappelle le raccourci Entrée au survol du mini-graphe. */}
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground-950/90 text-background-50 text-[10px] font-semibold whitespace-nowrap transition-opacity duration-150 ${
                survolGraphe ? "opacity-100" : "opacity-0"
              }`}
            >
              <i className="ri-keyboard-line"></i>
              Au clavier : flèches puis Entrée pour ouvrir
            </span>
            {semaines.map((s, i) => {
              const h = s.taux === null ? 2 : Math.max(4, Math.round((s.taux / 100) * 40));
              const title =
                s.taux === null
                  ? `Semaine du ${s.label} · aucun envoi`
                  : `Semaine du ${s.label} · ${s.taux}% (${s.ok} réussies, ${s.ko} en échec)${
                      s.motif ? ` · motif : ${s.motif}` : ""
                    }`;
              // Semaine sans donnée : barre inerte. Semaine renseignée : barre cliquable qui ouvre
              // la liste « Déjà traitées » filtrée sur cette semaine précise.
              if (s.taux === null) {
                return (
                  <span
                    key={i}
                    className={`flex-1 rounded-sm ${tonBarre(s.taux)}`}
                    style={{ height: `${h}px` }}
                    title={title}
                  ></span>
                );
              }
              return (
                <Link
                  key={i}
                  ref={(el) => {
                    barRefs.current[i] = el;
                  }}
                  to={`/app/relances-programmees?statut=all&semaine=${s.debut}`}
                  tabIndex={i === barFocus ? 0 : -1}
                  onKeyDown={(e) => onBarKeyDown(e, i)}
                  onFocus={() => setBarFocus(i)}
                  className={`flex-1 rounded-sm ${tonBarre(s.taux)} cursor-pointer transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-400`}
                  style={{ height: `${h}px` }}
                  title={`${title} · cliquer pour voir ces relances`}
                  aria-label={`Voir les relances traitées de la semaine du ${s.label}`}
                ></Link>
              );
            })}
          </div>
          <div className="mt-1 flex items-center justify-between text-[9px] text-foreground-400">
            <span>{semaines[0]?.label}</span>
            <span>{semaines[semaines.length - 1]?.label}</span>
          </div>
          <p className="mt-1.5 text-[10px] text-foreground-400 flex items-center gap-1">
            <i className="ri-cursor-line"></i>
            Cliquez une barre — ou au clavier, déplacez-vous avec les flèches puis Entrée — pour ouvrir ces relances
            dans « Déjà traitées ».
          </p>
        </div>
      )}

      {/* Comparaison des motifs d'échec par impact sur la fiabilité */}
      {motifs.length > 0 && (
        <div className="mt-4 pt-3 border-t border-background-200 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400 flex items-center gap-1.5">
              <i className="ri-sort-desc"></i>
              {triMotif === "nom"
                ? "Motifs classés par nom"
                : triMotif === "tendance"
                  ? "Motifs · reculent le moins en premier"
                  : "Motifs classés par impact sur le taux"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-600 whitespace-nowrap">
                <i className="ri-filter-3-line"></i>
                <span className="text-foreground-400">Tendance</span>
                <select
                  value={filtreTendance}
                  onChange={(e) => setFiltreTendance(e.target.value as "tous" | "recule" | "hausse" | "stable")}
                  title="N'afficher que les motifs qui reculent, montent ou stagnent sur 3 mois"
                  className="bg-transparent text-foreground-800 font-bold cursor-pointer outline-none"
                >
                  <option value="tous">Toutes</option>
                  <option value="recule">Reculent</option>
                  <option value="hausse">En hausse</option>
                  <option value="stable">Stables</option>
                </select>
              </label>
              <label className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-600 whitespace-nowrap">
                <i className="ri-sort-asc"></i>
                <span className="text-foreground-400">Tri</span>
                <select
                  value={triMotif}
                  onChange={(e) => changerTriMotif(e.target.value as "impact" | "nom" | "tendance")}
                  title="Trier le classement des motifs d'échec"
                  className="bg-transparent text-foreground-800 font-bold cursor-pointer outline-none"
                >
                  <option value="impact">Impact</option>
                  <option value="nom">Nom</option>
                  <option value="tendance">Tendance</option>
                </select>
              </label>
              <button
                type="button"
                onClick={handleExportMotifsCsv}
                title="Télécharger le classement des motifs d'échec en CSV (parts + points récupérables)"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-background-50 border border-background-200 text-foreground-600 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
              >
                <i className="ri-download-2-line"></i>
                CSV
              </button>
              <button
                type="button"
                onClick={handleExportMensuelCsv}
                title="Télécharger la ventilation mensuelle des motifs sur 3 mois (suivi de tendance dans un tableur)"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-background-50 border border-background-200 text-foreground-600 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
              >
                <i className="ri-calendar-line"></i>
                CSV 3 mois
              </button>
            </div>
          </div>

          {/* Mini-graphe d'évolution mensuelle globale (tous motifs confondus) */}
          {serieGlobaleMensuelle.some((v) => v > 0) && (
            <div className="p-2.5 rounded-md bg-background-50 border border-background-200">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400 flex items-center gap-1.5">
                  <i className="ri-bar-chart-2-line"></i>
                  Échecs totaux · 3 mois
                </p>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold whitespace-nowrap ${
                    deltaGlobal < 0 ? "text-accent-600" : deltaGlobal > 0 ? "text-red-600" : "text-foreground-500"
                  }`}
                  title="Évolution du nombre total d'échecs entre le plus ancien et le plus récent des 3 mois"
                >
                  <i
                    className={
                      deltaGlobal < 0 ? "ri-arrow-down-line" : deltaGlobal > 0 ? "ri-arrow-up-line" : "ri-subtract-line"
                    }
                  ></i>
                  {deltaGlobal < 0 ? "Recule" : deltaGlobal > 0 ? "En hausse" : "Stable"} ({deltaGlobal > 0 ? "+" : ""}
                  {deltaGlobal})
                </span>
              </div>
              <div className="mt-2 flex items-end gap-2 h-16">
                {serieGlobaleMensuelle.map((v, i) => {
                  const max = Math.max(...serieGlobaleMensuelle, 1);
                  const h = Math.max(3, Math.round((v / max) * 46));
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center justify-end gap-1"
                      title={`${moisLabels[i]} · ${v} échec${v > 1 ? "s" : ""} (tous motifs)`}
                    >
                      <span className="text-[9px] font-semibold text-foreground-600">{v}</span>
                      <span
                        className={`w-full rounded-sm ${v === 0 ? "bg-background-300" : "bg-red-400"}`}
                        style={{ height: `${h}px` }}
                      ></span>
                      <span className="text-[9px] text-foreground-400">{moisLabels[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {motifsTries.length === 0 && (
            <p className="text-[11px] text-foreground-500 py-1">Aucun motif ne correspond à ce filtre de tendance.</p>
          )}
          <ul className="flex flex-col gap-1.5">
            {motifsTries.slice(0, 6).map((m) => {
              const sansEmail = motifSansEmail(m.motif);
              const serie = motifsMonthly.get(m.motif) ?? [0, 0, 0];
              const serieMax = Math.max(...serie, 1);
              const premier = serie[0] ?? 0;
              const dernier = serie[serie.length - 1] ?? 0;
              const recule = dernier < premier;
              return (
                <li key={m.motif}>
                  {/* Ligne entièrement cliquable : ouvre l'aperçu détaillé des clients concernés */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setMotifOuvert(m.motif)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setMotifOuvert(m.motif);
                      }
                    }}
                    title={`Voir les clients concernés par ce motif : ${m.motif}`}
                    className="group flex flex-col gap-1.5 p-2 rounded-md cursor-pointer transition-colors hover:bg-background-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-400"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`flex items-center gap-1.5 min-w-0 text-[11px] ${
                          sansEmail ? "text-red-700 font-semibold" : "text-foreground-700"
                        }`}
                        title={m.motif}
                      >
                        <i className={`shrink-0 ${sansEmail ? "ri-mail-close-line" : "ri-information-line"}`}></i>
                        <span className="truncate">{m.motif}</span>
                        {m.motif === principalMotif && (
                          <span className="shrink-0 inline-flex items-center h-4 px-1.5 rounded-full bg-red-100 text-red-700 text-[9px] font-bold uppercase tracking-wide whitespace-nowrap">
                            Principal frein
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-foreground-500 whitespace-nowrap">×{m.count}</span>
                        <Link
                          to={`/app/relances-programmees?statut=echec&motif=${encodeURIComponent(m.motif)}`}
                          onClick={(e) => e.stopPropagation()}
                          title={`Ouvrir la liste « Déjà traitées » filtrée sur ce motif : ${m.motif}`}
                          className={`inline-flex items-center gap-0.5 h-5 px-1.5 rounded-md text-[10px] font-bold whitespace-nowrap cursor-pointer transition-opacity hover:opacity-80 ${tonGain(m.gainPts)}`}
                        >
                          +{m.gainPts} pts
                          <i className="ri-arrow-right-s-line"></i>
                        </Link>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-background-200 overflow-hidden">
                      <div className={`h-full ${sansEmail ? "bg-red-500" : "bg-red-400"}`} style={{ width: `${Math.min(100, m.part)}%` }}></div>
                    </div>
                    {/* Mini-courbe d'évolution sur 3 mois : vert si le motif recule, rouge s'il grossit */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="flex items-end gap-0.5 h-4"
                          role="img"
                          aria-label={`Évolution du nombre d'échecs « ${m.motif} » sur les 3 derniers mois`}
                          title="Nombre d'échecs de ce motif sur les 3 derniers mois (du plus ancien au plus récent)"
                        >
                          {serie.map((v, i) => (
                            <span
                              key={i}
                              className={`w-1.5 rounded-sm ${tonSerieMotif(serie)}`}
                              style={{ height: `${Math.max(2, Math.round((v / serieMax) * 16))}px` }}
                            ></span>
                          ))}
                        </div>
                        <span
                          className={`text-[9px] whitespace-nowrap ${
                            recule ? "text-accent-600" : dernier > premier ? "text-red-600" : "text-foreground-400"
                          }`}
                        >
                          {recule ? "Recule sur 3 mois" : dernier > premier ? "En hausse sur 3 mois" : "Stable sur 3 mois"}
                        </span>
                      </div>
                      <i className="ri-arrow-right-s-line shrink-0 text-foreground-400 group-hover:text-primary-600 transition-colors"></i>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {(sansEmailCount > 0 || clientsSansEmail.length > 0) && (
            <div className="mt-1 p-2.5 rounded-md bg-red-50 border border-red-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-red-100 text-red-700">
                  <i className="ri-mail-close-line"></i>
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-red-800">Clients sans email</p>
                  <p className="text-[10px] text-red-600">
                    {sansEmailCount > 0
                      ? `${sansEmailCount} échec${sansEmailCount > 1 ? "s" : ""} causé${sansEmailCount > 1 ? "s" : ""} par une adresse manquante`
                      : "Des fiches client sont incomplètes"}
                  </p>
                </div>
              </div>
              {clients.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowEmails(true)}
                  title="Renseigner les adresses manquantes, puis re-tenter d'un coup tous ces échecs « sans email »"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-refresh-line"></i>
                  Corriger & re-tenter
                  {clientsSansEmail.length > 0 ? ` (${clientsSansEmail.length})` : ""}
                </button>
              )}
              <Link
                to={`/app/relances-programmees?statut=echec`}
                title="Voir toutes les relances en échec dans la page Relances programmées"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-red-200 text-red-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-red-100 transition-colors"
              >
                <i className="ri-filter-3-line"></i>
                Voir les échecs
              </Link>
            </div>
          )}
        </div>
      )}

      {showEmails && (
        <CompleterEmailsModal
          clients={clients}
          relances={relances}
          retryScope="sansEmail"
          onClose={() => setShowEmails(false)}
          onSaved={onClientsChanged}
          onRelancesChanged={onRelancesChanged}
        />
      )}

      {motifOuvert && (
        <MotifClientsModal
          motif={motifOuvert}
          items={motifOuvertItems}
          onClose={() => setMotifOuvert(null)}
          onRelancesChanged={onRelancesChanged}
        />
      )}
    </div>
  );
}