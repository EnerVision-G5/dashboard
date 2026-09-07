/**
 * Zone de défilement à hauteur bornée.
 *
 * Plusieurs panneaux du dashboard affichent des listes dont la longueur ne
 * dépend pas de nous : les alertes d'un site agité, l'historique de ses pannes,
 * les constats du bandeau de qualité. Sans borne, un site en incident fait
 * grandir une carte jusqu'à repousser tout le reste de l'écran hors de vue —
 * c'est-à-dire qu'un incident rend l'interface illisible au moment précis où on
 * en a besoin.
 *
 * Deux points d'accessibilité, souvent manqués :
 *
 *   - une zone défilante doit être **atteignable au clavier**, sinon son
 *     contenu débordant est inaccessible à qui n'utilise pas la souris. D'où le
 *     `tabIndex={0}` ;
 *   - elle doit être **nommée**, faute de quoi un lecteur d'écran annonce une
 *     région sans dire de quoi elle parle. D'où le `label` obligatoire.
 *
 * Le nombre d'éléments reste affiché **hors** de la zone par les panneaux :
 * savoir qu'il y a trente alertes ne doit pas exiger de faire défiler.
 */

import type { ReactNode } from "react";

/** Hauteurs proposées, en classes Tailwind, pour rester dans l'échelle. */
export type ScrollHeight = "courte" | "moyenne" | "haute";

const HEIGHTS: Record<ScrollHeight, string> = {
  courte: "max-h-48",
  moyenne: "max-h-72",
  haute: "max-h-96",
};

interface ScrollAreaProps {
  children: ReactNode;
  /** Nom de la région, annoncé par les technologies d'assistance. */
  label: string;
  height?: ScrollHeight;
}

export function ScrollArea({ children, label, height = "moyenne" }: ScrollAreaProps) {
  return (
    <div
      // `region` plutôt que `group` : la zone a un nom et un contenu propre,
      // et se retrouve dans la liste des régions d'un lecteur d'écran.
      role="region"
      aria-label={label}
      tabIndex={0}
      className={`${HEIGHTS[height]} overflow-y-auto overscroll-contain rounded-controle`}
    >
      {children}
    </div>
  );
}
