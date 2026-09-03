/**
 * Lecture des jetons du design system depuis JavaScript (EV-47).
 *
 * Recharts colore ses tracés par des propriétés SVG, pas par des classes : il
 * lui faut des valeurs, là où le reste de l'interface se contente d'utilitaires
 * Tailwind. Plutôt que de réécrire les couleurs en dur — ce qui a déjà fait
 * diverger le graphique du reste de l'application — elles sont lues sur
 * `:root`, où Tailwind les publie en variables CSS.
 *
 * Les valeurs sont résolues une fois puis mémorisées : `getComputedStyle` force
 * un calcul de style, et un graphique en redessine ses séries à chaque rendu.
 */

/** Jetons dont le graphique a besoin, par leur nom de variable CSS. */
const TOKENS = {
  mesure: "--color-mesure-700",
  estimation: "--color-estimation-700",
  grille: "--color-ardoise-200",
  axe: "--color-ardoise-600",
} as const;

/** Nom d'un jeton lisible depuis le code. */
export type TokenName = keyof typeof TOKENS;

/**
 * Valeurs de repli, utilisées quand aucune feuille de style n'est chargée.
 *
 * C'est le cas sous jsdom : les tests montent les composants sans CSS, et un
 * `stroke=""` ferait échouer le rendu de Recharts. Ces valeurs ne servent
 * jamais dans un navigateur.
 */
const FALLBACKS: Record<TokenName, string> = {
  mesure: "#00786f",
  estimation: "#bb4d00",
  grille: "#e2e8f0",
  axe: "#45556c",
};

const cache = new Map<TokenName, string>();

/**
 * Rend la valeur calculée d'un jeton de couleur.
 *
 * Le cache est volontairement sans invalidation : le produit n'a pas de bascule
 * de thème à chaud. Le jour où il en aura une, c'est ici que le cache devra
 * être vidé.
 */
export function token(name: TokenName): string {
  const cached = cache.get(name);
  if (cached !== undefined) {
    return cached;
  }

  let value = "";
  if (typeof globalThis.getComputedStyle === "function" && globalThis.document !== undefined) {
    value = globalThis
      .getComputedStyle(globalThis.document.documentElement)
      .getPropertyValue(TOKENS[name])
      .trim();
  }

  const resolved = value === "" ? FALLBACKS[name] : value;
  cache.set(name, resolved);
  return resolved;
}
