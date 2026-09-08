/**
 * Bloc repliable, sur `<details>` natif.
 *
 * Deux détails secondaires encombraient l'écran : l'état interne du collecteur
 * et le détail des constats de qualité. Ils comptent quand on cherche une
 * cause, et ils gênent le reste du temps.
 *
 * `<details>` plutôt qu'un état React : le pliage fonctionne au clavier, est
 * annoncé comme tel par les lecteurs d'écran, survit à l'impression, et ne
 * demande aucune ligne de JavaScript. Le contenu reste dans le DOM une fois
 * replié — ce que la recherche du navigateur (Ctrl+F) sait d'ailleurs ouvrir.
 */

import type { ReactNode } from "react";

interface DisclosureProps {
  /** Ce qu'on lit quand le bloc est replié. */
  summary: string;
  children: ReactNode;
  /** Ouvert d'emblée quand le contenu est le sujet principal du panneau. */
  defaultOpen?: boolean;
}

export function Disclosure({ summary, children, defaultOpen = false }: DisclosureProps) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex cursor-pointer items-center gap-1.5 text-annexe font-medium tracking-wide text-ardoise-600 uppercase select-none hover:text-ardoise-900">
        {/* Le chevron est décoratif : le comportement est porté par
            `<summary>`, que les technologies d'assistance annoncent déjà. */}
        <span aria-hidden className="transition-transform group-open:rotate-90">
          ▸
        </span>
        {summary}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
