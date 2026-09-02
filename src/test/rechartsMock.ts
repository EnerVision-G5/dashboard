/**
 * Substitution de `ResponsiveContainer` pour les tests.
 *
 * Recharts mesure son conteneur avec `ResizeObserver`, qui rapporte 0 × 0 sous
 * jsdom : sans taille imposée, le graphique ne rendrait aucun élément. Le
 * reste de la bibliothèque est conservé tel quel.
 *
 * À utiliser depuis une fabrique `vi.mock` de premier niveau :
 *
 *     vi.mock("recharts", async (importOriginal) => {
 *       const { withFixedSizeContainer } = await import("../test/rechartsMock");
 *       return withFixedSizeContainer(await importOriginal());
 *     });
 */

import { cloneElement, type ReactElement } from "react";

const WIDTH = 800;
const HEIGHT = 400;

type Recharts = typeof import("recharts");

export function withFixedSizeContainer(actual: unknown): Recharts {
  return {
    ...(actual as Recharts),
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      cloneElement(children as ReactElement<Record<string, unknown>>, {
        width: WIDTH,
        height: HEIGHT,
      }),
  } as unknown as Recharts;
}
