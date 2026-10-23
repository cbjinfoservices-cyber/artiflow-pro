import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/hooks/useAuth";
import { useArtisanData } from "@/hooks/useArtisanData";
import {
  createIntervenant,
  deleteIntervenant,
  inviterIntervenant,
  metaInvitation,
  regenererCodeInvitation,
  setIntervenantActif,
  updateIntervenant,
  type Intervenant,
  type IntervenantPayload,
} from "@/lib/intervenants";
import { calculerStatsIntervenants } from "@/lib/intervenantsStats";
import { fetchPointages, type Pointage } from "@/lib/pointage";
import DataState from "@/pages/app/components/DataState";
import EmptyState from "@/pages/app/components/EmptyState";
import Modal from "@/pages/app/components/Modal";
import IntervenantFormModal from "@/pages/app/planning/components/IntervenantFormModal";
import IntervenantsKpis from "@/pages/app/intervenants/components/IntervenantsKpis";
import CarteIntervenant from "@/pages/app/intervenants/components/CarteIntervenant";
import FicheIntervenantPanel from "@/pages/app/intervenants/components/FicheIntervenantPanel";

/** Filtres rapides de la liste. */
type Filtre = "tous" | "actifs" | "invites" | "relance" | "inactifs";

/**
 * Page « Intervenants » : le poste de commande de l'équipe. On y retrouve la liste
 * complète des personnes (actives et archivées), l'état de leur compte, leurs
 * chiffres du mois, et une fiche détaillée par personne.
 */
export default function AppIntervenants() {
  usePageMeta(
    "Intervenants · ArtiFlow-pro",
    "Gérez votre équipe : fiches, invitations à créer un compte, heures pointées du mois, congés et planning de chacun.",
  );
  const { user } = useAuth();
  const { loading, error, creneaux, intervenants, indisponibilites, reload } = useArtisanData();

  const [pointages, setPointages] = useState<Pointage[]>([]);
  const [suiviLoading, setSuiviLoading] = useState(true);
  const [suiviError, setSuiviError] = useState<string | null>(null);

  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Intervenant | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<Intervenant | null>(null);
  const [ficheId, setFicheId] = useState<number | null>(null);
  const [invitantId, setInvitantId] = useState<number | null>(null);
  const [regenerantId, setRegenerantId] = useState<number | null>(null);

  const chargerPointages = useCallback(async () => {
    setSuiviLoading(true);
    setSuiviError(null);
    try {
      setPointages(await fetchPointages());
    } catch {
      setSuiviError("Les heures pointées n'ont pas pu être chargées. Réessayez dans un instant.");
    } finally {
      setSuiviLoading(false);
    }
  }, []);

  useEffect(() => {
    void chargerPointages();
  }, [chargerPointages]);

  const stats = useMemo(
    () => calculerStatsIntervenants({ intervenants, pointages, creneaux, indisponibilites }),
    [intervenants, pointages, creneaux, indisponibilites],
  );

  const actifs = useMemo(() => intervenants.filter((i) => i.actif), [intervenants]);
  const inactifs = useMemo(() => intervenants.filter((i) => !i.actif), [intervenants]);
  const rattaches = useMemo(() => actifs.filter((i) => i.compte_rattache).length, [actifs]);
  const aRelancer = useMemo(
    () => actifs.filter((i) => !i.compte_rattache && metaInvitation(i).relance),
    [actifs],
  );
  const invitationsEnAttente = useMemo(
    () =>
      actifs.filter(
        (i) => !i.compte_rattache && Boolean(i.compte_email) && metaInvitation(i).niveau === "jamais",
      ).length,
    [actifs],
  );
  const invitesSansCompte = useMemo(
    () => actifs.filter((i) => !i.compte_rattache && Boolean(i.compte_email) && Boolean(i.invitation_envoyee_le)),
    [actifs],
  );
  const minutesMois = useMemo(() => {
    let total = 0;
    stats.forEach((s) => {
      total += s.minutesMois;
    });
    return total;
  }, [stats]);
  const absentsAujourdhui = useMemo(() => {
    let total = 0;
    stats.forEach((s) => {
      if (s.absentAujourdhui) total += 1;
    });
    return total;
  }, [stats]);

  const listeFiltree = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    const base = intervenants.filter((i) => {
      if (filtre === "actifs" && !i.actif) return false;
      if (filtre === "inactifs" && i.actif) return false;
      if (filtre === "relance" && !(i.actif && !i.compte_rattache && metaInvitation(i).relance)) return false;
      if (filtre === "invites" && !invitesSansCompte.some((x) => x.id === i.id)) return false;
      if (!terme) return true;
      return [i.nom, i.metier, i.telephone, i.compte_email]
        .filter(Boolean)
        .some((valeur) => String(valeur).toLowerCase().includes(terme));
    });
    // Les personnes actives d'abord, puis par ordre alphabétique.
    return [...base].sort((a, b) => {
      if (a.actif !== b.actif) return a.actif ? -1 : 1;
      return a.nom.localeCompare(b.nom, "fr");
    });
  }, [intervenants, filtre, recherche, invitesSansCompte]);

  const fiche = useMemo(
    () => intervenants.find((i) => i.id === ficheId) ?? null,
    [intervenants, ficheId],
  );

  const recharger = () => {
    void chargerPointages();
    void reload();
  };

  const ouvrirCreation = () => {
    setEditing(null);
    setActionError(null);
    setFormOpen(true);
  };

  const ouvrirEdition = (intervenant: Intervenant) => {
    setEditing(intervenant);
    setActionError(null);
    setFormOpen(true);
  };

  const enregistrer = async (payload: IntervenantPayload) => {
    if (!user) return;
    setBusy(true);
    setActionError(null);
    setInfo(null);
    try {
      if (editing) {
        await updateIntervenant(editing.id, payload);
        setInfo(`Fiche de ${payload.nom} mise à jour.`);
      } else {
        await createIntervenant(user.id, payload);
        setInfo(`${payload.nom} a été ajouté à l'équipe.`);
      }
      setFormOpen(false);
      setEditing(null);
      await reload();
    } catch {
      setActionError("L'enregistrement de la fiche a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const envoyerInvitation = async (
    email: string,
    nom: string,
  ): Promise<{ error: string | null; code?: string | null; expire?: string | null }> => {
    try {
      const res = await inviterIntervenant({ email, nom });
      await reload();
      return { error: null, code: res.code, expire: res.expire };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "L'envoi de l'invitation a échoué.",
        code: null,
        expire: null,
      };
    }
  };

  const inviter = async (intervenant: Intervenant) => {
    if (!intervenant.compte_email) {
      setActionError("Renseignez d'abord un email de compte sur la fiche pour pouvoir inviter.");
      return;
    }
    setInvitantId(intervenant.id);
    setActionError(null);
    setInfo(null);
    try {
      await inviterIntervenant({ email: intervenant.compte_email, nom: intervenant.nom });
      setInfo(`Invitation envoyée à ${intervenant.compte_email}.`);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "L'envoi de l'invitation a échoué.");
    } finally {
      setInvitantId(null);
    }
  };

  const regenerer = async (intervenant: Intervenant) => {
    setRegenerantId(intervenant.id);
    setActionError(null);
    setInfo(null);
    try {
      const code = await regenererCodeInvitation(intervenant.id);
      await reload();
      setInfo(
        intervenant.compte_email
          ? `Nouveau code ${code} généré. Renvoyez l'invitation pour le transmettre.`
          : `Nouveau code ${code} généré. Renseignez un email de compte pour l'envoyer.`,
      );
    } catch {
      setActionError("La génération d'un nouveau code a échoué. Réessayez.");
    } finally {
      setRegenerantId(null);
    }
  };

  const basculerActif = async (intervenant: Intervenant) => {
    setActionError(null);
    setInfo(null);
    try {
      await setIntervenantActif(intervenant.id, !intervenant.actif);
      setInfo(
        intervenant.actif
          ? `${intervenant.nom} est archivé : il n'apparaît plus dans les sélecteurs du planning.`
          : `${intervenant.nom} est réactivé dans l'équipe.`,
      );
      await reload();
    } catch {
      setActionError("La mise à jour de la fiche a échoué. Réessayez.");
    }
  };

  const supprimer = async () => {
    if (!confirmDelete) return;
    setActionError(null);
    setInfo(null);
    try {
      await deleteIntervenant(confirmDelete.id);
      setInfo(`${confirmDelete.nom} a été retiré de l'équipe. Ses interventions restent, sans affectation.`);
      setConfirmDelete(null);
      setFicheId(null);
      await reload();
    } catch {
      setActionError("La suppression a échoué. Réessayez.");
    }
  };

  const chips: { cle: Filtre; label: string; icon: string; compte: number }[] = [
    { cle: "tous", label: "Tous", icon: "ri-team-line", compte: intervenants.length },
    { cle: "actifs", label: "Actifs", icon: "ri-user-line", compte: actifs.length },
    { cle: "invites", label: "Invit\u00e9s sans compte", icon: "ri-mail-check-line", compte: invitesSansCompte.length },
    { cle: "relance", label: "\u00c0 relancer", icon: "ri-alarm-warning-line", compte: aRelancer.length },
    { cle: "inactifs", label: "Inactifs", icon: "ri-archive-line", compte: inactifs.length },
  ];

  return (
    <DataState loading={loading || suiviLoading} error={error ?? suiviError} onRetry={recharger}>
      <div className="flex flex-col gap-5 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading font-bold text-lg text-foreground-950">Intervenants</h1>
            <p className="text-xs text-foreground-500">
              Les personnes que vous pouvez affecter à une intervention, avec leurs heures, leurs congés et l'état de
              leur compte.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to="/app/planning"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
            >
              <i className="ri-calendar-2-line"></i>
              Planning
            </Link>
            <Link
              to="/app/pointages"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
            >
              <i className="ri-timer-line"></i>
              Pointages
            </Link>
            <button
              type="button"
              onClick={ouvrirCreation}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-user-add-line"></i>
              Ajouter un intervenant
            </button>
          </div>
        </div>

        <IntervenantsKpis
          actifs={actifs.length}
          inactifs={inactifs.length}
          rattaches={rattaches}
          invitations={invitationsEnAttente + invitesSansCompte.length}
          minutesMois={minutesMois}
          absentsAujourdhui={absentsAujourdhui}
        />

        {actionError && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {actionError}
          </p>
        )}

        {info && (
          <div className="flex items-start gap-2 rounded-md bg-primary-100 border border-primary-200 px-3 py-2">
            <i className="ri-checkbox-circle-line text-primary-700 mt-0.5"></i>
            <p className="flex-1 text-xs text-primary-900">{info}</p>
            <button
              type="button"
              onClick={() => setInfo(null)}
              aria-label="Fermer le message"
              className="w-6 h-6 shrink-0 flex items-center justify-center rounded hover:bg-primary-200 cursor-pointer"
            >
              <i className="ri-close-line text-primary-700 text-[13px]"></i>
            </button>
          </div>
        )}

        {intervenants.length === 0 ? (
          <EmptyState
            icon="ri-team-line"
            title="Votre équipe est encore vide"
            text="Ajoutez les personnes que vous pouvez affecter à vos interventions. Vous pourrez ensuite les inviter à créer leur compte pour qu'elles voient leur planning."
          >
            <button
              type="button"
              onClick={ouvrirCreation}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-user-add-line"></i>
              Ajouter un intervenant
            </button>
          </EmptyState>
        ) : (
          <>
            {aRelancer.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg bg-accent-100 border border-accent-200 p-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50">
                    <i className="ri-alarm-warning-line"></i>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground-950">
                      {aRelancer.length} personne{aRelancer.length > 1 ? "s" : ""} à relancer
                    </p>
                    <p className="text-[11px] text-foreground-600 truncate">
                      {aRelancer.map((i) => i.nom).join(", ")} · invitation jamais envoyée ou devenue ancienne.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFiltre("relance")}
                  className="self-start sm:self-auto inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
                >
                  <i className="ri-filter-3-line"></i>
                  Voir les fiches
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-foreground-500 inline-flex items-center gap-1">
                  <i className="ri-filter-3-line"></i> Afficher
                </span>
                {chips.map((c) => {
                  const actif = filtre === c.cle;
                  return (
                    <button
                      key={c.cle}
                      type="button"
                      onClick={() => setFiltre(c.cle)}
                      aria-pressed={actif}
                      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        actif
                          ? "bg-foreground-900 text-background-50"
                          : "bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-200"
                      }`}
                    >
                      <i className={c.icon}></i>
                      {c.label}
                      <span
                        className={`inline-flex items-center justify-center min-w-[18px] h-5 px-1 rounded-full text-[10px] font-bold ${
                          actif ? "bg-background-50/25" : "bg-background-200 text-foreground-500"
                        }`}
                      >
                        {c.compte}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full sm:w-64">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
                <input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher un nom, un métier..."
                  className="w-full h-9 pl-8 pr-3 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-900 outline-none focus:border-primary-400"
                />
              </div>
            </div>

            {listeFiltree.length === 0 ? (
              <div className="flex flex-col items-center text-center px-6 py-10 rounded-lg bg-background-100 border border-background-200">
                <span className="w-12 h-12 flex items-center justify-center rounded-full bg-background-200 text-foreground-500 text-xl">
                  <i className="ri-search-eye-line"></i>
                </span>
                <p className="mt-3 text-sm text-foreground-600">
                  Aucune fiche ne correspond à cette recherche ou à ce filtre.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRecherche("");
                    setFiltre("tous");
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors"
                >
                  <i className="ri-refresh-line"></i>
                  Réinitialiser
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {listeFiltree.map((intervenant) => (
                  <CarteIntervenant
                    key={intervenant.id}
                    intervenant={intervenant}
                    stats={stats.get(intervenant.id)}
                    invitant={invitantId === intervenant.id}
                    onOuvrir={() => setFicheId(intervenant.id)}
                    onInviter={() => void inviter(intervenant)}
                    onModifier={() => ouvrirEdition(intervenant)}
                  />
                ))}
              </div>
            )}

            <p className="text-[11px] text-foreground-500 inline-flex items-start gap-1.5">
              <i className="ri-information-line mt-0.5"></i>
              <span>
                Un intervenant inactif reste enregistré et garde son historique, mais n'apparaît plus dans les
                sélecteurs du planning. Supprimer une fiche conserve ses interventions : elles passent simplement en
                « non affecté ».
              </span>
            </p>
          </>
        )}

        {formOpen && (
          <IntervenantFormModal
            intervenant={editing}
            busy={busy}
            onClose={() => {
              setFormOpen(false);
              setEditing(null);
            }}
            onSubmit={(payload) => void enregistrer(payload)}
            onInviter={envoyerInvitation}
          />
        )}

        {fiche && (
          <FicheIntervenantPanel
            intervenant={fiche}
            stats={stats.get(fiche.id)}
            creneaux={creneaux}
            pointages={pointages}
            indisponibilites={indisponibilites}
            invitant={invitantId === fiche.id}
            regenerant={regenerantId === fiche.id}
            onClose={() => setFicheId(null)}
            onModifier={() => ouvrirEdition(fiche)}
            onInviter={() => void inviter(fiche)}
            onRegenerer={() => void regenerer(fiche)}
            onBasculerActif={() => void basculerActif(fiche)}
            onSupprimer={() => setConfirmDelete(fiche)}
          />
        )}

        {confirmDelete && (
          <Modal title="Supprimer cet intervenant ?" onClose={() => setConfirmDelete(null)}>
            <p className="text-sm text-foreground-600">
              <strong className="text-foreground-900">{confirmDelete.nom}</strong> sera retiré de l'équipe. Ses
              interventions existantes sont conservées : elles passeront simplement en « non affecté ».
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void supprimer()}
                className="h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap"
              >
                Supprimer
              </button>
            </div>
          </Modal>
        )}
      </div>
    </DataState>
  );
}