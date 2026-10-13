/**
 * Interdit l'accès DIRECT à `localStorage`.
 *
 * Seul le module central `src/lib/stockageLocal.ts` est autorisé à toucher `localStorage`
 * (il l'encapsule derrière des accès sûrs). Tout le reste doit passer par ce module.
 *
 * Exemple (bon) :
 *   import { lireBrut, ecrireBrut } from "@/lib/stockageLocal";
 *   const v = lireBrut("artiflow:...");
 *
 * Exemple (mauvais, signalé) :
 *   localStorage.getItem("artiflow:...");
 *   window.localStorage.setItem("artiflow:...", "x");
 *
 * NB : `sessionStorage` reste autorisé (il n'est pas visé par cette règle).
 */
export default {
  rules: {
    'no-direct-localstorage': {
      meta: {
        type: 'problem',
        docs: {
          description:
            "Interdit l'accès direct à localStorage ; passer par le module central stockageLocal.",
        },
        schema: [],
        messages: {
          forbidden:
            "Accès direct à localStorage interdit. Passez par le module central @/lib/stockageLocal (lireBrut / ecrireBrut / supprimer / lireJson / ecrireJson / clesAvecPrefixe…).",
        },
      },
      create(context) {
        return {
          MemberExpression(node) {
            const obj = node.object;
            // Cas 1 : localStorage.xxx
            const direct = obj?.type === 'Identifier' && obj.name === 'localStorage';
            // Cas 2 : window.localStorage / globalThis.localStorage (window.localStorage.xxx)
            const viaGlobal =
              obj?.type === 'MemberExpression' &&
              obj.property?.type === 'Identifier' &&
              obj.property.name === 'localStorage';
            if (direct || viaGlobal) {
              context.report({ node, messageId: 'forbidden' });
            }
          },
        };
      },
    },
  },
};