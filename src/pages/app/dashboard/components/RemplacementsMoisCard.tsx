import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useComptableRemplacements } from "@/hooks/useComptableRemplacements";
import { downloadCsv, toCsv } from "@/lib/csv";
import { todayISO } from "@/lib/dates";
import {
  lireMoisEpingles,
  basculerMoisEpingle,
  viderMoisEpingles,
  deplacerMoisEpingle,
  monterMoisEnTete,
  reordonnerMoisEpingles,
  reinitialiserPrioriteEpingles,
  trierMoisEpingles,
  lireTriEpingles,
  basculerTriEpingles,
  marquerRetourPlusFaible,
  consommerRetourPlusFaible,
  ecrireDernierMoisFaible,
  lireDernierMoisClavier,
  lireEpinglesReplie,
  ecrireEpinglesReplie,
  REMPLACEMENTS_EPINGLE_EVENT,
  REMPLACEMENTS_TRI_EPINGLES_EVENT,
  REMPLACEMENTS_DERNIER_CLAVIER_EVENT,
  REMPLACEMENTS_EPINGLES_REPLIE_EVENT,
  libelleTriEpingles,
  copierTextePressePapiers,
  texteRangementEpingles,
  type TriEpinglesMode,
} from "@/lib/remplacementsSurveillance";
import { lireSeuilRemp, SEUIL_REMPLACEMENTS_EVENT } from "@/lib/remplacementsSeuil";
import RemplacementsRangementBar from "@/components/feature/RemplacementsRangementBar";
import Toast from "@/components/base/Toast";
import ErreurChargementInline from "@/pages/app/components/ErreurChargementInline";

/** Libellé lisible d'une clé de mois (« 2026-10 » → « Octobre 2026 »). */
function moisCleLabel(cle: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(cle);
  if (!m) return cle;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Modes de tri proposés, identiques à la vue « Remplacements » de l'Espace comptable. */
type TriKey = "date" | "renvois" | "adresse";

const TRIS: { key: TriKey; label: string; icon: string; title: string }[] = [
  { key: "date", label: "Date", icon: "ri-calendar-line", title: "Ouvrir trié par date du dernier renvoi" },
  { key: "renvois", label: "Renvois", icon: "ri-swap-box-line", title: "Ouvrir trié par nombre de renvois" },
  { key: "adresse", label: "Adresse", icon: "ri-sort-asc", title: "Ouvrir trié par adresse (A → Z)" },
];

/** Clé de stockage du tri, partagée avec la vue « Remplacements » de l'Espace comptable. */
const TRI_STORAGE_KEY = "artiflow:compta:remplacements-tri";

/** Relit le tri mémorisé (préférence d'affichage), « date » par défaut. */
function lireTriMemorise(): TriKey {
  try {
    const v = localStorage.getItem(TRI_STORAGE_KEY);
    if (v === "date" || v === "renvois" || v === "adresse") return v;
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
  return "date";
}

/**
 * Raccourci « X remplacements ce mois » du tableau de bord : met en avant le nombre de renvois
 * à une adresse ponctuelle (journal ou bilan d'archivage) réalisés ce mois-ci, et ouvre en un
 * clic la vue « Remplacements » de l'Espace comptable pour retrouver le détail.
 */
export default function RemplacementsMoisCard() {
  const navigate = useNavigate();
  const { remplacements, loading, error, reload } = useComptableRemplacements(200);
  // Tri choisi sur le raccourci : il est appliqué à la vue « Remplacements » à l'ouverture.
  const [tri, setTri] = useState<TriKey>(lireTriMemorise);
  // Mois épinglé « à surveiller » (partagé avec le mini-graphe des remplacements de l'Espace comptable) :
  // permet d'épingler le mois en cours directement depuis le tableau de bord, sans ouvrir la comptabilité.
  const [moisEpingles, setMoisEpingles] = useState<string[]>(() => lireMoisEpingles());
  // Seuil partagé du mini-graphe des remplacements : sous ce seuil, un mois est jugé « faible ».
  // Sert à colorer les mois épinglés à faible activité directement sur la pastille.
  const [seuilRemp, setSeuilRemp] = useState<number>(() => lireSeuilRemp());
  // Mois le plus faible à surligner brièvement au retour de la comptabilité (marqueur de session).
  const [pulsePlusFaible, setPulsePlusFaible] = useState<string | null>(null);
  // Dernier mois ouvert au clavier (Entrée sur une barre du mini-graphe des remplacements) :
  // reproposé ici en « Reprendre » pour rouvrir ce mois d'un seul clic depuis le tableau de bord.
  const [dernierMoisClavier, setDernierMoisClavier] = useState<string>(() => lireDernierMoisClavier());
  // Pastille « Épinglé » repliée ou non (préférence d'affichage mémorisée) : replier la liste des
  // mois surveillés allège la carte du tableau de bord quand beaucoup de mois sont épinglés.
  const [epinglesReplie, setEpinglesReplie] = useState<boolean>(() => lireEpinglesReplie());
  // Mois en cours de glisser-déposer dans la pastille « Épinglé » (réordonnancement de priorité).
  const [dragMois, setDragMois] = useState<string | null>(null);
  // Mode de rangement des mois épinglés (priorité manuelle ou chronologique), partagé entre les vues.
  const [triEpingles, setTriEpingles] = useState<TriEpinglesMode>(() => lireTriEpingles());
  // Petit message de retour (copie du rangement depuis la pastille « Épinglé »).
  const [copieMsg, setCopieMsg] = useState<string | null>(null);

  // Au retour de la comptabilité après avoir ouvert le mois le plus faible, on surligne brièvement
  // sa puce (ou le bouton dédié) sur la pastille, pour montrer d'où l'on revient.
  useEffect(() => {
    const cle = consommerRetourPlusFaible();
    if (!cle) return undefined;
    setPulsePlusFaible(cle);
    const t = window.setTimeout(() => setPulsePlusFaible(null), 2400);
    return () => window.clearTimeout(t);
  }, []);

  // Suit les mois épinglés si la préférence change (même page ou autre onglet).
  useEffect(() => {
    const sync = () => setMoisEpingles(lireMoisEpingles());
    window.addEventListener(REMPLACEMENTS_EPINGLE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(REMPLACEMENTS_EPINGLE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Suit le seuil des remplacements si le réglage change (partagé avec la comptabilité).
  useEffect(() => {
    const sync = () => setSeuilRemp(lireSeuilRemp());
    window.addEventListener(SEUIL_REMPLACEMENTS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SEUIL_REMPLACEMENTS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Suit le dernier mois ouvert au clavier si la préférence change (même page ou autre onglet).
  useEffect(() => {
    const sync = () => setDernierMoisClavier(lireDernierMoisClavier());
    window.addEventListener(REMPLACEMENTS_DERNIER_CLAVIER_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(REMPLACEMENTS_DERNIER_CLAVIER_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Suit l'état replié / déplié de la pastille « Épinglé » (préférence partagée avec la vue
  // Remplacements) si elle change (même page ou autre onglet).
  useEffect(() => {
    const sync = () => setEpinglesReplie(lireEpinglesReplie());
    window.addEventListener(REMPLACEMENTS_EPINGLES_REPLIE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(REMPLACEMENTS_EPINGLES_REPLIE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Suit le mode de rangement des mois épinglés (préférence partagée avec la vue Remplacements)
  // si elle change (même page ou autre onglet).
  useEffect(() => {
    const sync = () => setTriEpingles(lireTriEpingles());
    window.addEventListener(REMPLACEMENTS_TRI_EPINGLES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(REMPLACEMENTS_TRI_EPINGLES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const handleTri = (key: TriKey) => {
    setTri(key);
    try {
      localStorage.setItem(TRI_STORAGE_KEY, key);
    } catch {
      /* préférence de confort : ignorée si le stockage est indisponible */
    }
  };

  // Renvois de remplacement du mois en cours (adresse ponctuelle réellement utilisée).
  const stats = useMemo(() => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const duMois = remplacements.filter((r) => {
      const d = new Date(r.envoye_le);
      if (Number.isNaN(d.getTime())) return false;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === prefix;
    });
    const adresses = new Set(duMois.map((r) => r.adresse.trim().toLowerCase()));
    return { count: duMois.length, adresses: adresses.size };
  }, [remplacements]);

  // Mois en cours, pour le libellé (« ... ce mois de octobre »).
  const moisLabel = new Date().toLocaleDateString("fr-FR", { month: "long" });

  // Clé « AAAA-MM » du mois en cours : c'est ce mois que le raccourci « Épingler ce mois » épinglera.
  const cleMoisCourant = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  // Mois épinglés dans l'ordre affiché sur la pastille « Épinglé » : soit l'ordre de priorité manuel
  // mémorisé (les premiers mois sont les plus prioritaires), soit l'ordre chronologique des mois
  // selon le mode de rangement choisi (bouton « Trier d'un clic »).
  const moisEpinglesTries = useMemo(() => trierMoisEpingles(moisEpingles), [moisEpingles, triEpingles]);

  // Détail des renvois de remplacement par mois (« AAAA-MM ») : journaux et bilans séparés,
  // pour l'export CSV des mois épinglés (même détail journal/bilan que le mini-graphe de la compta).
  const renvoisDetailParMois = useMemo(() => {
    const map = new Map<string, { journal: number; bilan: number; total: number }>();
    remplacements.forEach((r) => {
      const d = new Date(r.envoye_le);
      if (Number.isNaN(d.getTime())) return;
      const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = map.get(cle) ?? { journal: 0, bilan: 0, total: 0 };
      if (r.type === "bilan") cur.bilan += 1;
      else if (r.type === "journal") cur.journal += 1;
      cur.total += 1;
      map.set(cle, cur);
    });
    return map;
  }, [remplacements]);

  // Mois « record » de l'historique : le mois ayant cumulé le plus de renvois de remplacement,
  // mis en avant sur le raccourci pour repérer d'un coup d'œil le pic d'activité.
  const record = useMemo(() => {
    const counts = new Map<string, number>();
    remplacements.forEach((r) => {
      const d = new Date(r.envoye_le);
      if (Number.isNaN(d.getTime())) return;
      const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      counts.set(cle, (counts.get(cle) ?? 0) + 1);
    });
    let bestCle = "";
    let best = 0;
    counts.forEach((n, cle) => {
      if (n > best) {
        best = n;
        bestCle = cle;
      }
    });
    if (best < 1) return null;
    const m = /^(\d{4})-(\d{2})$/.exec(bestCle);
    const label = m
      ? new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      : bestCle;
    return { cle: bestCle, label: label.charAt(0).toUpperCase() + label.slice(1), count: best };
  }, [remplacements]);

  // Adresse ponctuelle la plus utilisée (le « remplaçant habituel ») : on l'ouvre d'un clic,
  // en la distinguant seulement si elle a réellement servi plusieurs fois.
  const habituel = useMemo(() => {
    const counts = new Map<string, { cle: string; count: number }>();
    remplacements.forEach((r) => {
      const cle = r.adresse.trim().toLowerCase();
      if (!cle) return;
      const current = counts.get(cle);
      counts.set(cle, { cle, count: (current?.count ?? 0) + 1 });
    });
    let best: { cle: string; count: number } | null = null;
    counts.forEach((v) => {
      if (!best || v.count > best.count) best = v;
    });
    return best && best.count >= 2 ? best : null;
  }, [remplacements]);

  const handleVoir = () => {
    navigate(`/app/comptabilite?vue=remplacements&tri=${tri}`);
  };

  const handleVoirHabituel = () => {
    if (!habituel) return;
    navigate(`/app/comptabilite?vue=remplacements&adresse=${encodeURIComponent(habituel.cle)}&tri=${tri}`);
  };

  // Ouvre la vue « Remplacements » avec le filtre rapide « Mois record uniquement » déjà actif,
  // pour ne montrer que les pièces du mois le plus actif de l'historique.
  const handleVoirRecord = () => {
    navigate(`/app/comptabilite?vue=remplacements&record=1&tri=${tri}`);
  };

  // Ouvre la vue « Remplacements » filtrée sur les mois épinglés à surveiller, pour retrouver
  // d'un clic les pièces de ces mois depuis le tableau de bord.
  const handleVoirEpingles = () => {
    navigate(`/app/comptabilite?vue=remplacements&epingles=1&tri=${tri}`);
  };

  // Détail journaux / bilans d'un mois épinglé (zéro partout si aucune pièce sur ce mois).
  const detailMoisEpingle = (cle: string) =>
    renvoisDetailParMois.get(cle) ?? { journal: 0, bilan: 0, total: 0 };

  // Vrai si le mois épinglé est à faible activité (total > 0 et sous le seuil réglé) : sa puce de
  // la pastille prend alors un dégradé secondary, pour repérer les mois faibles d'un coup d'œil.
  const estMoisFaible = (cle: string) => {
    const d = renvoisDetailParMois.get(cle);
    return Boolean(d && d.total > 0 && d.total < seuilRemp);
  };

  // Ouvre la comptabilité filtrée sur un seul mois épinglé (clic sur ce mois dans la pastille),
  // pour retrouver d'un clic les pièces de ce mois précis.
  const handleVoirMois = (cle: string) => {
    navigate(`/app/comptabilite?vue=remplacements&moisremp=${cle}&tri=${tri}`);
  };

  // Reprend le dernier mois ouvert au clavier depuis le mini-graphe des remplacements (de la
  // comptabilité) : rouvre la comptabilité filtrée sur ce mois et surligne brièvement sa barre.
  const handleReprendreClavier = () => {
    if (!dernierMoisClavier) return;
    navigate(`/app/comptabilite?vue=remplacements&moisremp=${dernierMoisClavier}&tri=${tri}`);
  };

  // Détache d'un coup tous les mois épinglés, directement depuis la pastille « Épinglé ».
  const handleToutDetacher = () => {
    viderMoisEpingles();
    setMoisEpingles([]);
  };

  // Replie ou déplie la liste des mois épinglés affichée dans la pastille, et mémorise le choix
  // pour le retrouver à la prochaine visite (préférence d'affichage purement locale).
  const basculerEpinglesReplie = () => {
    setEpinglesReplie((prev) => {
      const next = !prev;
      ecrireEpinglesReplie(next);
      return next;
    });
  };

  // Déplace un mois épinglé dans l'ordre de priorité de la surveillance (flèches haut / bas de la
  // bulle des puces « Épinglé »). L'ordre est partagé avec la vue Remplacements de l'Espace comptable.
  const handleDeplacerMois = (cle: string, direction: -1 | 1) => {
    setMoisEpingles(deplacerMoisEpingle(cle, direction));
  };

  // Remonte un mois épinglé directement en tête de la surveillance d'un seul clic (flèche « monter en
  // tête » des puces de la pastille). L'ordre est partagé avec la vue Remplacements de l'Espace comptable.
  const handleMonterMoisEnTete = (cle: string) => {
    setMoisEpingles(monterMoisEnTete(cle));
  };

  // Réinitialise la priorité de surveillance : restaure l'ordre d'épinglage d'origine des mois
  // surveillés (du plus récemment épinglé au plus ancien), en effaçant les réordonnancements manuels.
  const handleReinitialiserPriorite = () => {
    setMoisEpingles(reinitialiserPrioriteEpingles());
  };

  // Réordonne les mois épinglés par glisser-déposer d'une puce sur une autre (la puce déposée prend
  // la place de la puce cible), pour prioriser la surveillance d'un geste.
  const handleDropMois = (cle: string) => {
    if (!dragMois || dragMois === cle) {
      setDragMois(null);
      return;
    }
    const ordre = [...moisEpingles];
    const from = ordre.indexOf(dragMois);
    const to = ordre.indexOf(cle);
    if (from < 0 || to < 0) {
      setDragMois(null);
      return;
    }
    ordre.splice(from, 1);
    ordre.splice(to, 0, dragMois);
    setMoisEpingles(reordonnerMoisEpingles(ordre));
    setDragMois(null);
  };

  // Bascule d'un clic le rangement des mois épinglés : priorité manuelle ↔ ordre chronologique des
  // mois. La préférence est partagée avec la vue Remplacements de l'Espace comptable.
  const handleBasculerTriEpingles = () => {
    setTriEpingles(basculerTriEpingles());
  };

  // Copie en presse-papiers le mode de rangement + la liste priorisée des mois épinglés,
  // directement depuis la pastille « Épinglé » (sans passer par le bandeau d'actions).
  const handleCopierRangement = async () => {
    const ok = await copierTextePressePapiers(texteRangementEpingles(moisEpinglesTries, triEpingles));
    setCopieMsg(ok ? "Rangement copié dans le presse-papiers" : "Copie indisponible dans ce navigateur");
  };

  // Exporte en CSV les mois épinglés « à surveiller » avec le détail journal / bilan par mois,
  // directement depuis la pastille « Épinglé » du tableau de bord.
  const handleExportEpinglesCsv = () => {
    if (moisEpinglesTries.length === 0) return;
    // Mois le plus faible parmi les mois épinglés exportés : celui qui cumule le moins de renvois
    // (hors mois sans aucune pièce). Sert à repérer d'un coup d'œil le creux dans le CSV.
    const moisFaibleCsv = moisEpinglesTries.reduce<{ cle: string; total: number } | null>((min, cle) => {
      const t = (renvoisDetailParMois.get(cle) ?? { total: 0 }).total;
      if (t <= 0) return min;
      if (!min || t < min.total) return { cle, total: t };
      return min;
    }, null);
    const headers = ["Mois", "Priorité", "Rang", "Journaux", "Bilans", "Total", "Mois le plus faible"];
    let totalJournal = 0;
    let totalBilan = 0;
    let totalGeneral = 0;
    const totalEpinglesCsv = moisEpinglesTries.length;
    const rows: (string | number)[][] = moisEpinglesTries.map((cle, idx) => {
      const detail = renvoisDetailParMois.get(cle) ?? { journal: 0, bilan: 0, total: 0 };
      totalJournal += detail.journal;
      totalBilan += detail.bilan;
      totalGeneral += detail.total;
      return [
        moisCleLabel(cle),
        idx + 1,
        `${idx + 1}/${totalEpinglesCsv}`,
        detail.journal,
        detail.bilan,
        detail.total,
        moisFaibleCsv && moisFaibleCsv.cle === cle ? "Oui" : "Non",
      ];
    });
    rows.push(["Total", "", "", totalJournal, totalBilan, totalGeneral, ""]);
    // Libellé d'en-tête du mode de rangement (aligné sur le PDF), pour tracer dans le classeur
    // le rangement utilisé (priorité manuelle ou ordre chronologique des mois).
    downloadCsv(
      `mois-epingles-${todayISO()}.csv`,
      `${libelleTriEpingles(triEpingles)}\r\n${toCsv(headers, rows)}`,
    );
  };

  // Mois le plus faible de la période récente (le mois actif ayant le moins de renvois), mis en
  // avant sur le raccourci pour ouvrir d'un clic le creux d'activité, comme le bouton du mini-graphe
  // de l'Espace comptable.
  const moisPlusFaible = useMemo(() => {
    const now = new Date();
    const actifs: { cle: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const detail = renvoisDetailParMois.get(cle);
      if (!detail || detail.total <= 0) continue;
      actifs.push({ cle, label: moisCleLabel(cle), total: detail.total });
    }
    if (actifs.length === 0) return null;
    return actifs.reduce((min, m) => (m.total < min.total ? m : min), actifs[0]);
  }, [renvoisDetailParMois]);

  // Ouvre la comptabilité filtrée sur le mois le plus faible de la période récente (le creux
  // d'activité), d'un clic depuis le tableau de bord. On mémorise ce mois pour surligner sa puce
  // au retour sur le tableau de bord.
  const handleOuvrirPlusFaible = () => {
    if (!moisPlusFaible) return;
    marquerRetourPlusFaible(moisPlusFaible.cle);
    ecrireDernierMoisFaible(moisPlusFaible.cle);
    navigate(`/app/comptabilite?vue=remplacements&moisremp=${moisPlusFaible.cle}&faible=1&tri=${tri}`);
  };

  // Exporte en CSV le mois le plus faible (journaux / bilans de ce mois), directement depuis
  // l'infobulle de la pastille « Épinglé », pour archiver le creux d'activité d'un coup d'œil.
  const handleExportPlusFaibleCsv = () => {
    if (!moisPlusFaible) return;
    const detail = renvoisDetailParMois.get(moisPlusFaible.cle) ?? { journal: 0, bilan: 0, total: 0 };
    const headers = ["Mois", "Journaux", "Bilans", "Total"];
    const rows: (string | number)[][] = [
      [moisCleLabel(moisPlusFaible.cle), detail.journal, detail.bilan, detail.total],
    ];
    downloadCsv(`mois-plus-faible-${moisPlusFaible.cle}-${todayISO()}.csv`, toCsv(headers, rows));
  };

  if (error) {
    return (
      <ErreurChargementInline
        titre="Remplacements comptables"
        message={error}
        onRetry={reload}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 rounded-lg bg-background-100 border border-background-200 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={handleVoir}
        title="Voir la liste des remplacements de l'Espace comptable"
        className="flex items-center gap-3 text-left rounded-lg px-2 py-1 -mx-2 hover:bg-background-200/70 cursor-pointer transition-colors"
      >
        <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-xl">
          <i className="ri-user-shared-line"></i>
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-700">Remplacements comptables</p>
          {loading && remplacements.length === 0 ? (
            <p className="font-heading font-bold text-xl text-foreground-500 leading-tight inline-flex items-center gap-2">
              <i className="ri-loader-4-line animate-spin text-base"></i>
              Chargement…
            </p>
          ) : (
            <p className="font-heading font-bold text-2xl text-foreground-950 leading-tight">
              {stats.count}{" "}
              <span className="text-sm font-semibold text-foreground-600">
                remplacement{stats.count > 1 ? "s" : ""} ce mois
              </span>
            </p>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-700 mt-0.5">
            Voir le détail des renvois
            <i className="ri-arrow-right-s-line"></i>
          </span>
        </div>
      </button>
      <div className="flex flex-wrap items-center gap-3">
        {/* Tri choisi, appliqué à la vue « Remplacements » à l'ouverture */}
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
            <i className="ri-sort-desc"></i>
            Trier
          </span>
          <div className="flex gap-0.5 p-0.5 rounded-full bg-background-50 border border-background-200 w-fit">
            {TRIS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => handleTri(t.key)}
                title={t.title}
                aria-pressed={tri === t.key}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  tri === t.key ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                <i className={t.icon}></i>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {stats.count > 0 && (
          <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-background-50 border border-accent-200 text-xs font-semibold text-accent-800 whitespace-nowrap">
            <i className="ri-user-3-line"></i>
            {stats.adresses} adresse{stats.adresses > 1 ? "s" : ""} ponctuelle{stats.adresses > 1 ? "s" : ""}
          </span>
        )}
        {habituel && (
          <button
            type="button"
            onClick={handleVoirHabituel}
            title="Ouvrir la vue Remplacements filtrée sur l'adresse la plus utilisée"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-50 border border-accent-200 text-xs font-semibold text-accent-800 whitespace-nowrap cursor-pointer hover:border-accent-400 transition-colors"
          >
            <i className="ri-medal-line"></i>
            Voir le remplaçant habituel
          </button>
        )}
        {record && (
          <span
            title={`Mois record : ${record.count} renvoi${record.count > 1 ? "s" : ""} en ${record.label}`}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-accent-100 border border-accent-200 text-xs font-semibold text-accent-800 whitespace-nowrap"
          >
            <i className="ri-award-line"></i>
            Record : {record.label} · {record.count}
          </span>
        )}
        {record && (
          <button
            type="button"
            onClick={handleVoirRecord}
            title={`Ouvrir la vue Remplacements filtrée sur le mois record (${record.label})`}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-accent-100 border border-accent-300 text-xs font-semibold text-accent-800 whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
          >
            <i className="ri-award-line"></i>
            Mois record uniquement
          </button>
        )}
        {moisEpingles.length > 0 && (
          <div className="relative group/epingles">
            <span className="inline-flex items-stretch rounded-full bg-secondary-100 border border-secondary-200 overflow-hidden whitespace-nowrap">
              <button
                type="button"
                onClick={handleVoirEpingles}
                title={`Ouvrir la comptabilité filtrée sur les ${moisEpingles.length} mois épinglés`}
                className="inline-flex items-center gap-1.5 h-9 pl-3 pr-2 text-xs font-semibold text-secondary-900 whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
              >
                <i className="ri-pushpin-2-fill"></i>
                Épinglé
                <span
                  className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-secondary-500 text-background-50 text-[10px] font-bold"
                  title={`${moisEpingles.length} mois épinglé${moisEpingles.length > 1 ? "s" : ""}`}
                >
                  {moisEpingles.length}
                </span>
              </button>
              {/* Replier / déplier la liste des mois épinglés : allège la carte quand beaucoup de mois sont surveillés. */}
              <button
                type="button"
                onClick={basculerEpinglesReplie}
                aria-expanded={!epinglesReplie}
                title={epinglesReplie ? "Déplier la liste des mois épinglés" : "Replier la liste des mois épinglés"}
                aria-label={epinglesReplie ? "Déplier les mois épinglés" : "Replier les mois épinglés"}
                className="hidden xl:inline-flex items-center justify-center w-6 h-9 border-l border-secondary-200 text-secondary-800 whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
              >
                <i className={epinglesReplie ? "ri-arrow-down-s-line" : "ri-arrow-up-s-line"}></i>
              </button>
              {/* Mois épinglés directement cliquables (les plus récents en tête, tri du plus récent au plus ancien) */}
              {!epinglesReplie && (
              <span className="hidden xl:inline-flex items-center gap-1 px-1.5">
                {moisEpinglesTries.slice(0, 3).map((cle, idx) => {
                  const d = detailMoisEpingle(cle);
                  const faible = estMoisFaible(cle);
                  return (
                    <span
                      key={cle}
                      draggable
                      onDragStart={() => setDragMois(cle)}
                      onDragEnd={() => setDragMois(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDropMois(cle)}
                      title="Glissez pour réordonner la priorité · cliquez le mois pour l'ouvrir"
                      className={`inline-flex items-stretch rounded-full border overflow-hidden transition-colors cursor-grab active:cursor-grabbing ${
                        faible
                          ? "bg-gradient-to-r from-secondary-600 to-secondary-200 border-secondary-300 text-background-50"
                          : "bg-background-50/80 border-secondary-200 text-secondary-900"
                      }${pulsePlusFaible === cle ? " animate-puce-highlight" : ""}${dragMois === cle ? " opacity-60" : ""}`}
                    >
                      <span
                        className="inline-flex items-center justify-center h-6 min-w-[24px] pl-1.5 pr-0.5 text-[9px] font-bold opacity-85 whitespace-nowrap"
                        title={`Rang de surveillance ${idx + 1}/${moisEpinglesTries.length}`}
                      >
                        {idx + 1}/{moisEpinglesTries.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleVoirMois(cle)}
                        title={
                          faible
                            ? `Mois faible (${d.total} renvoi${d.total > 1 ? "s" : ""} < seuil ${seuilRemp}) — ouvrir la comptabilité filtrée sur ${moisCleLabel(cle)} (${d.journal} journal${d.journal > 1 ? "x" : ""} · ${d.bilan} bilan${d.bilan > 1 ? "s" : ""})`
                            : `Ouvrir la comptabilité filtrée sur ${moisCleLabel(cle)} (${d.journal} journal${d.journal > 1 ? "x" : ""} · ${d.bilan} bilan${d.bilan > 1 ? "s" : ""})`
                        }
                        className="inline-flex items-center gap-1 h-6 pl-2 pr-1 text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors"
                      >
                        <i className="ri-drag-move-2-line opacity-70"></i>
                        {moisCleLabel(cle)}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMonterMoisEnTete(cle)}
                        disabled={idx === 0}
                        title={idx === 0 ? "Déjà en tête de surveillance" : `Monter ${moisCleLabel(cle)} en tête de surveillance`}
                        aria-label={`Monter ${moisCleLabel(cle)} en tête`}
                        className="inline-flex items-center justify-center w-5 h-6 border-l border-foreground-900/10 whitespace-nowrap cursor-pointer hover:bg-background-50/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <i className="ri-arrow-up-double-line text-[11px]"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMoisEpingles(basculerMoisEpingle(cle))}
                        title={`Détacher ${moisCleLabel(cle)} de la surveillance`}
                        aria-label={`Détacher ${moisCleLabel(cle)}`}
                        className="inline-flex items-center justify-center w-5 h-6 border-l border-foreground-900/10 whitespace-nowrap cursor-pointer hover:bg-background-50/30 transition-colors"
                      >
                        <i className="ri-close-line text-[11px]"></i>
                      </button>
                    </span>
                  );
                })}
                {moisEpinglesTries.length > 3 && (
                  <span className="text-[10px] font-semibold text-foreground-500 whitespace-nowrap">
                    +{moisEpinglesTries.length - 3}
                  </span>
                )}
              </span>
              )}
              {/* Copie le mode de rangement + la liste priorisée des mois épinglés, directement
                  depuis la pastille « Épinglé » (sans passer par le bandeau d'actions). */}
              <button
                type="button"
                onClick={handleCopierRangement}
                title="Copier le mode de rangement et la liste priorisée des mois épinglés dans le presse-papiers"
                aria-label="Copier le rangement"
                className="inline-flex items-center justify-center w-7 h-9 border-l border-secondary-200 text-secondary-800 whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
              >
                <i className="ri-clipboard-line"></i>
              </button>
              <button
                type="button"
                onClick={handleExportEpinglesCsv}
                title={`Exporter les ${moisEpingles.length} mois épinglé${moisEpingles.length > 1 ? "s" : ""} en CSV (mois + détail journaux / bilans)`}
                aria-label="Exporter les mois épinglés en CSV"
                className="inline-flex items-center justify-center w-7 h-9 border-l border-secondary-200 text-secondary-800 whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
              >
                <i className="ri-file-text-line"></i>
              </button>
              <button
                type="button"
                onClick={handleToutDetacher}
                title={`Détacher d'un coup les ${moisEpingles.length} mois épinglé${moisEpingles.length > 1 ? "s" : ""}`}
                aria-label="Détacher tous les mois épinglés"
                className="inline-flex items-center justify-center w-7 h-9 border-l border-secondary-200 text-secondary-800 whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
              >
                <i className="ri-close-line"></i>
              </button>
            </span>
            {/* Infobulle : mini-récap journaux / bilans par mois épinglé, chaque mois cliquable */}
            <div className="absolute left-0 top-full z-40 pt-2 w-72 hidden group-hover/epingles:block">
              <div className="p-3 rounded-md bg-foreground-950 text-background-50 border border-foreground-800">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-background-50/60">
                  Mois épinglés · journaux / bilans
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {moisEpinglesTries.map((cle, idx) => {
                    const d = detailMoisEpingle(cle);
                    const dernierIdx = moisEpinglesTries.length - 1;
                    return (
                      <li key={cle}>
                        <div className="flex items-center gap-1">
                          {/* Récap « rang de surveillance » cliquable (au lieu du seul numéro) : équivalent à
                              l'écran de la colonne « Priorité » du CSV, il remonte le mois en tête au clic. */}
                          <button
                            type="button"
                            onClick={() => handleMonterMoisEnTete(cle)}
                            disabled={idx === 0}
                            title={
                              idx === 0
                                ? `Rang de surveillance ${idx + 1}/${moisEpinglesTries.length} — déjà en tête`
                                : `Rang de surveillance ${idx + 1}/${moisEpinglesTries.length} — cliquer pour remonter ${moisCleLabel(cle)} en tête`
                            }
                            aria-label={`Rang de surveillance ${idx + 1} sur ${moisEpinglesTries.length}`}
                            className="shrink-0 inline-flex items-center gap-1 h-5 pl-1.5 pr-1.5 rounded-full bg-background-50/20 text-[9px] font-bold whitespace-nowrap cursor-pointer hover:bg-background-50/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <i className="ri-arrow-up-double-line text-[10px]"></i>
                            {idx + 1}/{moisEpinglesTries.length}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVoirMois(cle)}
                            title={`Ouvrir la comptabilité filtrée sur ${moisCleLabel(cle)}`}
                            className="flex-1 flex items-center justify-between gap-2 px-2 py-1 rounded-md text-left cursor-pointer hover:bg-background-50/10 transition-colors"
                          >
                            <span className="text-[11px] font-semibold">{moisCleLabel(cle)}</span>
                            <span className="inline-flex items-center gap-1.5 text-[10px] whitespace-nowrap">
                              <span className="inline-flex items-center gap-1" title={`${d.journal} journal${d.journal > 1 ? "x" : ""}`}>
                                <i className="ri-calendar-schedule-line text-primary-300"></i>
                                {d.journal}
                              </span>
                              <span className="text-background-50/40">·</span>
                              <span className="inline-flex items-center gap-1" title={`${d.bilan} bilan${d.bilan > 1 ? "s" : ""}`}>
                                <i className="ri-archive-drawer-line text-secondary-300"></i>
                                {d.bilan}
                              </span>
                              <span className="text-background-50/40">·</span>
                              <span className="font-bold" title={`${d.total} renvoi${d.total > 1 ? "s" : ""}`}>
                                {d.total}
                              </span>
                            </span>
                          </button>
                          <span className="shrink-0 inline-flex items-center rounded-md border border-background-50/20 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => handleDeplacerMois(cle, -1)}
                              disabled={idx === 0}
                              title={idx === 0 ? "Déjà en tête de surveillance" : `Rendre ${moisCleLabel(cle)} plus prioritaire`}
                              aria-label={`Rendre ${moisCleLabel(cle)} plus prioritaire`}
                              className="inline-flex items-center justify-center w-5 h-5 border-l border-background-50/20 text-background-50/70 whitespace-nowrap cursor-pointer hover:bg-background-50/15 hover:text-background-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <i className="ri-arrow-up-s-line text-[12px]"></i>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeplacerMois(cle, 1)}
                              disabled={idx === dernierIdx}
                              title={idx === dernierIdx ? "Déjà en bas de la surveillance" : `Rendre ${moisCleLabel(cle)} moins prioritaire`}
                              aria-label={`Rendre ${moisCleLabel(cle)} moins prioritaire`}
                              className="inline-flex items-center justify-center w-5 h-5 border-l border-background-50/20 text-background-50/70 whitespace-nowrap cursor-pointer hover:bg-background-50/15 hover:text-background-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <i className="ri-arrow-down-s-line text-[12px]"></i>
                            </button>
                          </span>
                          <button
                            type="button"
                            onClick={() => setMoisEpingles(basculerMoisEpingle(cle))}
                            title={`Détacher ${moisCleLabel(cle)} de la surveillance (sans fermer la bulle)`}
                            aria-label={`Détacher ${moisCleLabel(cle)}`}
                            className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-md text-background-50/50 whitespace-nowrap cursor-pointer hover:bg-background-50/15 hover:text-background-50 transition-colors"
                          >
                            <i className="ri-pushpin-2-fill text-[11px]"></i>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 pt-2 border-t border-background-50/20 text-[10px] text-background-50/60 italic">
                  Cliquez un mois pour ouvrir la comptabilité filtrée sur ce mois.
                </p>
                {moisPlusFaible && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleOuvrirPlusFaible}
                      title={`Ouvrir la comptabilité filtrée sur le mois le plus faible (${moisPlusFaible.label} · ${moisPlusFaible.total} renvoi${moisPlusFaible.total > 1 ? "s" : ""})`}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 h-7 px-2 rounded-md bg-background-50/10 border border-background-50/25 text-[10px] font-semibold text-background-50 whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors ${
                        pulsePlusFaible === moisPlusFaible.cle ? "animate-puce-highlight" : ""
                      }`}
                    >
                      <i className="ri-arrow-down-circle-line"></i>
                      Ouvrir le mois le plus faible
                    </button>
                    <button
                      type="button"
                      onClick={handleExportPlusFaibleCsv}
                      title={`Exporter le mois le plus faible (${moisPlusFaible.label}) en CSV (journaux / bilans)`}
                      aria-label="Exporter le mois le plus faible en CSV"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-background-50/10 border border-background-50/25 text-background-50 whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
                    >
                      <i className="ri-file-text-line text-[11px]"></i>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {dernierMoisClavier && (
          <button
            type="button"
            onClick={handleReprendreClavier}
            title={`Reprendre le dernier mois ouvert au clavier (${moisCleLabel(dernierMoisClavier)}) : ouvrir la comptabilité filtrée sur ce mois`}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-accent-100 border border-accent-300 text-xs font-semibold text-accent-800 whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
          >
            <i className="ri-keyboard-line"></i>
            Reprendre : {moisCleLabel(dernierMoisClavier)}
          </button>
        )}
        {moisPlusFaible && (
          <button
            type="button"
            onClick={handleOuvrirPlusFaible}
            title={`Ouvrir la comptabilité filtrée sur le mois le plus faible (${moisPlusFaible.label} · ${moisPlusFaible.total} renvoi${moisPlusFaible.total > 1 ? "s" : ""})`}
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-50 border border-secondary-200 text-xs font-semibold text-secondary-800 whitespace-nowrap cursor-pointer hover:border-secondary-400 transition-colors ${
              pulsePlusFaible === moisPlusFaible.cle && !moisEpinglesTries.slice(0, 3).includes(moisPlusFaible.cle)
                ? "animate-puce-highlight"
                : ""
            }`}
          >
            <i className="ri-arrow-down-circle-line"></i>
            Ouvrir le mois le plus faible
          </button>
        )}
        {moisEpingles.length > 1 && (
          <button
            type="button"
            onClick={handleBasculerTriEpingles}
            aria-pressed={triEpingles === "chrono"}
            title={
              triEpingles === "chrono"
                ? "Ranger les mois épinglés par priorité manuelle"
                : "Ranger les mois épinglés dans l'ordre chronologique des mois"
            }
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-50 border border-secondary-200 text-xs font-semibold text-secondary-800 whitespace-nowrap cursor-pointer hover:border-secondary-400 transition-colors"
          >
            <i className={triEpingles === "chrono" ? "ri-sort-asc" : "ri-sort-desc"}></i>
            Trier d'un clic
            <span className="inline-flex items-center h-5 px-1.5 rounded-full bg-secondary-100 text-[10px] font-bold text-secondary-900 uppercase tracking-wide">
              {triEpingles === "chrono" ? "chrono" : "priorité"}
            </span>
          </button>
        )}
        {moisEpingles.length > 0 && (
          <RemplacementsRangementBar
            size="md"
            moisEpinglesTries={moisEpinglesTries}
            triEpingles={triEpingles}
            nbMoisEpingles={moisEpingles.length}
            onResetPriorite={handleReinitialiserPriorite}
          />
        )}
        <button
          type="button"
          onClick={() => setMoisEpingles(basculerMoisEpingle(cleMoisCourant))}
          aria-pressed={moisEpingles.includes(cleMoisCourant)}
          title={
            moisEpingles.includes(cleMoisCourant)
              ? "Retirer le repère « à surveiller » de ce mois dans le mini-graphe des remplacements"
              : "Épingler ce mois à surveiller dans le mini-graphe des remplacements (repère permanent, sans ouvrir la comptabilité)"
          }
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            moisEpingles.includes(cleMoisCourant)
              ? "bg-secondary-500 border-secondary-500 text-background-50 hover:bg-secondary-600"
              : "bg-background-50 border-secondary-200 text-secondary-800 hover:border-secondary-400"
          }`}
        >
          <i className={moisEpingles.includes(cleMoisCourant) ? "ri-pushpin-2-fill" : "ri-pushpin-2-line"}></i>
          {moisEpingles.includes(cleMoisCourant) ? "Mois épinglé" : "Épingler ce mois"}
        </button>
        <button
          type="button"
          onClick={handleVoir}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
        >
          <i className="ri-arrow-right-line"></i>
          Voir les remplacements
        </button>
        <span className="text-[11px] text-foreground-400 hidden lg:inline">({moisLabel})</span>
      </div>

      {copieMsg && <Toast message={copieMsg} onClose={() => setCopieMsg(null)} icon="ri-clipboard-line" />}
    </div>
  );
}