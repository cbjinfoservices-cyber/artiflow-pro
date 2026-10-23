/**
 * Vérification d'une adresse email côté navigateur : format puis domaine.
 *
 * Objectif : éviter de relancer un email vers une adresse encore invalide (faute de frappe
 * sur le domaine, point en trop, extension fantaisiste…). On ne peut pas interroger le DNS
 * depuis le navigateur ; on combine donc une validation stricte de la syntaxe et un contrôle
 * des domaines les plus courants (distance d'édition) pour proposer la bonne adresse.
 */

/** Résultat d'une vérification, prêt à être affiché dans le formulaire. */
export interface VerificationAdresse {
  /** L'adresse est-elle exploitable en l'état ? */
  ok: boolean;
  /** La partie « avant le @ » est-elle correcte ? */
  formatOk: boolean;
  /** Le domaine est-il correctement formé (et non une faute de frappe connue) ? */
  domaineOk: boolean;
  /** Problèmes constatés, formulés pour l'artisan. */
  problemes: string[];
  /** Adresse corrigée suggérée (faute de domaine reconnue), sinon null. */
  suggestion: string | null;
  /** Adresse nettoyée (espaces retirés, domaine en minuscules). */
  adresse: string;
}

/** Domaines de messagerie les plus utilisés par les clients : base de la détection de fautes. */
const DOMAINES_COURANTS = [
  "gmail.com",
  "googlemail.com",
  "orange.fr",
  "wanadoo.fr",
  "hotmail.fr",
  "hotmail.com",
  "outlook.fr",
  "outlook.com",
  "live.fr",
  "msn.com",
  "yahoo.fr",
  "yahoo.com",
  "free.fr",
  "sfr.fr",
  "laposte.net",
  "bbox.fr",
  "icloud.com",
  "me.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "gmx.fr",
  "numericable.fr",
  "aliceadsl.fr",
  "club-internet.fr",
  "neuf.fr",
];

/** Extensions techniques connues (au-delà, on accepte toute extension alphabétique plausible). */
const EXTENSIONS_COURANTES = new Set([
  "fr",
  "com",
  "net",
  "org",
  "eu",
  "be",
  "ch",
  "lu",
  "ca",
  "co",
  "io",
  "info",
  "pro",
  "biz",
  "name",
  "email",
  "paris",
  "re",
  "mq",
  "gp",
  "gf",
  "yt",
  "pm",
  "wf",
  "nc",
  "pf",
  "tf",
]);

const RE_PARTIE_LOCALE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/;
const RE_LIBELLE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

/** Distance d'édition (Levenshtein) : sert à repérer « gmial.com » face à « gmail.com ». */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  const lignes = a.length + 1;
  const colonnes = b.length + 1;
  let precedente = Array.from({ length: colonnes }, (_, j) => j);
  for (let i = 1; i < lignes; i += 1) {
    const courante = [i];
    for (let j = 1; j < colonnes; j += 1) {
      const cout = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      courante[j] = Math.min(precedente[j] + 1, courante[j - 1] + 1, precedente[j - 1] + cout);
    }
    precedente = courante;
  }
  return precedente[colonnes - 1];
}

/** Vérifie une adresse email et explique précisément ce qui ne va pas. */
export function verifierAdresseEmail(email: string): VerificationAdresse {
  const adresse = (email ?? "").trim().replace(/\s+/g, "");
  const problemes: string[] = [];
  let formatOk = false;
  let domaineOk = false;
  let suggestion: string | null = null;

  if (adresse === "") {
    return {
      ok: false,
      formatOk: false,
      domaineOk: false,
      problemes: ["Aucune adresse à vérifier : renseignez l'email du client."],
      suggestion: null,
      adresse,
    };
  }

  const arobase = adresse.split("@");
  if (arobase.length !== 2) {
    problemes.push(
      arobase.length < 2
        ? "Il manque le signe @ entre le nom et le domaine."
        : "L'adresse contient plusieurs signes @ : il n'en faut qu'un.",
    );
  }

  const partieLocale = arobase[0] ?? "";
  const domaine = (arobase[1] ?? "").toLowerCase();

  // --- Partie locale -------------------------------------------------------
  if (partieLocale === "") {
    problemes.push("Le nom d'utilisateur, avant le @, est vide.");
  } else if (partieLocale.length > 64) {
    problemes.push("La partie avant le @ dépasse 64 caractères.");
  } else if (partieLocale.startsWith(".") || partieLocale.endsWith(".")) {
    problemes.push("La partie avant le @ ne peut pas commencer ni finir par un point.");
  } else if (partieLocale.includes("..")) {
    problemes.push("La partie avant le @ ne peut pas contenir deux points de suite.");
  } else if (!RE_PARTIE_LOCALE.test(partieLocale)) {
    problemes.push("La partie avant le @ contient un caractère interdit (espace, virgule, accent…).");
  } else {
    formatOk = true;
  }

  // --- Domaine -------------------------------------------------------------
  if (domaine === "") {
    problemes.push("Le domaine, après le @, est vide.");
  } else if (domaine.startsWith(".") || domaine.endsWith(".")) {
    problemes.push("Le domaine ne peut pas commencer ni finir par un point.");
  } else if (domaine.includes("..")) {
    problemes.push("Le domaine contient deux points de suite.");
  } else {
    const libelles = domaine.split(".");
    if (libelles.length < 2) {
      problemes.push("Le domaine est incomplet : il manque l'extension (par exemple .fr ou .com).");
    } else {
      const extension = libelles[libelles.length - 1];
      const libellesInvalides = libelles.filter((l) => !RE_LIBELLE.test(l));
      if (libellesInvalides.length > 0) {
        problemes.push(`Le domaine contient un élément invalide (« ${libellesInvalides[0]} »).`);
      } else if (!/^[a-z]{2,24}$/.test(extension)) {
        problemes.push(`L'extension « .${extension} » n'est pas valide (lettres uniquement, 2 minimum).`);
      } else {
        domaineOk = true;
        // Extension inconnue mais très proche d'une extension courante : on suggère la bonne.
        if (!EXTENSIONS_COURANTES.has(extension)) {
          const proche = Array.from(EXTENSIONS_COURANTES).find((ext) => distance(extension, ext) === 1);
          if (proche) {
            domaineOk = false;
            suggestion = `${partieLocale}@${libelles.slice(0, -1).join(".")}.${proche}`;
            problemes.push(`L'extension « .${extension} » ressemble à « .${proche} ».`);
          }
        }
      }
    }
  }

  // --- Faute de frappe sur un domaine connu --------------------------------
  if (domaine.includes(".") && suggestion === null) {
    const exact = DOMAINES_COURANTS.includes(domaine);
    if (!exact) {
      let meilleur: { domaine: string; ecart: number } | null = null;
      DOMAINES_COURANTS.forEach((courant) => {
        const ecart = distance(domaine, courant);
        if (ecart > 0 && ecart <= 2 && (!meilleur || ecart < meilleur.ecart)) {
          meilleur = { domaine: courant, ecart };
        }
      });
      if (meilleur !== null) {
        const trouve: { domaine: string; ecart: number } = meilleur;
        domaineOk = false;
        suggestion = `${partieLocale}@${trouve.domaine}`;
        problemes.push(`Le domaine « ${domaine} » ressemble à « ${trouve.domaine} » : faute de frappe probable.`);
      }
    }
  }

  return {
    ok: problemes.length === 0 && formatOk && domaineOk,
    formatOk,
    domaineOk,
    problemes,
    suggestion,
    adresse,
  };
}

/** Vrai si l'adresse, une fois nettoyée, respecte au moins la syntaxe générale (nom@domaine.ext). */
export function adresseSyntaxiquementValide(email: string): boolean {
  return verifierAdresseEmail(email).ok;
}