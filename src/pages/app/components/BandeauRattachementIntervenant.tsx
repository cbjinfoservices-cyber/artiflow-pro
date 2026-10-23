import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Modal from "@/pages/app/components/Modal";
import { cleArtiflow, ecrireBrut, lireBrut } from "@/lib/stockageLocal";
import { rattacherIntervenantParCode } from "@/lib/rattachementIntervenant";

const CLE_VU = cleArtiflow("intervenant", "rattachementVu");
/** Un compte est « frais » pendant une semaine : fenêtre pendant laquelle on propose le garde-fou. */
const JOURS_FRAICHEUR = 7;

function profilRecent(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= JOURS_FRAICHEUR * 86_400_000;
}

/**
 * Garde-fou d'inscription : quand un compte fraîchement créé n'est reconnu comme AUCUNE fiche
 * intervenant (l'email ne correspond à rien), on propose de le rattacher à une fiche grâce au
 * CODE D'INVITATION reçu par email. Le code est la seule clé : la personne ne peut donc se
 * rattacher qu'à la fiche à laquelle le code correspond, pas à une fiche choisie librement.
 */
export default function BandeauRattachementIntervenant() {
  const { session, profile, isIntervenant, isGestionnaire, intervenantLoading, refreshIntervenant } = useAuth();
  const navigate = useNavigate();

  const [ouvert, setOuvert] = useState(false);
  const [cache, setCache] = useState(false);
  const [code, setCode] = useState("");
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const eligible = useMemo(() => {
    if (!session || isGestionnaire || isIntervenant || intervenantLoading) return false;
    if (lireBrut(CLE_VU) === "1") return false;
    return profilRecent(profile?.created_at ?? null);
  }, [session, isGestionnaire, isIntervenant, intervenantLoading, profile]);

  if (!eligible || cache) return null;

  const masquer = () => {
    ecrireBrut(CLE_VU, "1");
    setCache(true);
  };

  const rattacher = async () => {
    const saisie = code.trim().toUpperCase();
    if (saisie.length < 4) {
      setErreur("Saisissez le code d'invitation reçu par email (au moins 4 caractères).");
      return;
    }
    setChargement(true);
    setErreur(null);
    setMessage(null);
    try {
      const res = await rattacherIntervenantParCode(saisie);
      ecrireBrut(CLE_VU, "1");
      await refreshIntervenant();
      setMessage(
        res.nom
          ? `Compte rattaché à la fiche « ${res.nom} ». Ouverture de votre planning…`
          : "Compte rattaché. Ouverture de votre planning…",
      );
      window.setTimeout(() => navigate("/app/mon-planning"), 900);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Le rattachement a échoué. Réessayez.");
    } finally {
      setChargement(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg bg-secondary-100 border border-secondary-200 p-3.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-secondary-500 text-background-50">
            <i className="ri-links-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-950">Vous avez été invité(e) par une entreprise ?</p>
            <p className="text-[11px] text-foreground-600">
              Si cette adresse ne correspond à aucune fiche intervenant, rattachez votre compte avec le code
              d'invitation reçu par email pour retrouver votre planning.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setOuvert(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
          >
            <i className="ri-link"></i> Rattacher mon compte
          </button>
          <button
            type="button"
            onClick={masquer}
            title="Ne plus afficher"
            aria-label="Ne plus afficher ce rappel"
            className="w-9 h-9 flex items-center justify-center rounded-md text-foreground-500 hover:bg-secondary-200 cursor-pointer transition-colors"
          >
            <i className="ri-close-line"></i>
          </button>
        </div>
      </div>

      {ouvert && (
        <Modal
          title="Rattacher mon compte avec mon code d'invitation"
          subtitle="Le code se trouve dans l'email d'invitation de votre entreprise."
          onClose={() => setOuvert(false)}
          wide
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2.5 rounded-md bg-secondary-100 border border-secondary-200 p-3">
              <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-secondary-500 text-background-50">
                <i className="ri-shield-keyhole-line text-sm"></i>
              </span>
              <p className="text-[11px] text-foreground-600 leading-relaxed">
                Le code détermine seul la fiche à rattacher : impossible de se tromper de fiche ou de choisir celle
                d'une autre entreprise. Copiez-le tel quel, sans espace.
              </p>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground-700">Code d'invitation</span>
              <div className="relative">
                <i className="ri-key-2-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void rattacher();
                    }
                  }}
                  placeholder="EX. K7MQ2PXR"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={12}
                  className="w-full h-11 pl-9 pr-3 rounded-md bg-background-100 border border-background-200 text-base font-semibold tracking-[0.2em] outline-none focus:border-primary-400"
                />
              </div>
            </label>

            {erreur && (
              <p className="text-xs text-red-600 inline-flex items-center gap-1.5">
                <i className="ri-error-warning-line"></i>
                {erreur}
              </p>
            )}
            {message && (
              <p className="text-xs text-secondary-700 inline-flex items-center gap-1.5">
                <i className="ri-checkbox-circle-line"></i>
                {message}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOuvert(false)}
                className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={rattacher}
                disabled={chargement}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60"
              >
                {chargement ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-link"></i>}
                Rattacher mon compte
              </button>
            </div>

            <p className="text-[11px] text-foreground-500 inline-flex items-start gap-1.5">
              <i className="ri-information-line mt-0.5"></i>
              Pas de code ? Votre inscription a probablement été faite avec une autre adresse que celle de votre
              fiche : connectez-vous alors avec l'adresse exacte de votre invitation, ou demandez un nouveau code à
              votre entreprise.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}