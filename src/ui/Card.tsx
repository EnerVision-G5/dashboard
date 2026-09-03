/**
 * Surface de base du design system (EV-47).
 *
 * Une carte titrée rend une `<section>` reliée à son titre par
 * `aria-labelledby` : un lecteur d'écran annonce alors la région par son nom,
 * ce qu'une pile de `<div>` ne permet pas.
 *
 * C'est ici que vivent les quatre états — chargement, erreur, vide, contenu.
 * Un panneau qui charge, un panneau en erreur et un panneau vide sont trois
 * états d'une carte, pas trois composants.
 */

import { useId } from "react";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  /** Titre de la région. Sans lui, la carte reste une simple surface. */
  title?: string;
  /** Ligne d'accroche sous le titre. */
  description?: string;
  /** Contenu aligné à droite du titre : une commande, un badge. */
  action?: ReactNode;
  /** Rembourrage réduit, pour une carte qui contient déjà ses propres marges. */
  compact?: boolean;
}

export function Card({ children, title, description, action, compact = false }: CardProps) {
  const titleId = useId();
  const surface = [
    "rounded-surface border border-ardoise-200 bg-white shadow-surface",
    compact ? "p-4" : "p-6",
  ].join(" ");

  const header =
    title === undefined ? null : (
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={titleId} className="text-titre-section font-semibold text-ardoise-900">
            {title}
          </h2>
          {description !== undefined && (
            <p className="mt-1 text-corps text-ardoise-600">{description}</p>
          )}
        </div>
        {action}
      </div>
    );

  if (title === undefined) {
    return <div className={surface}>{children}</div>;
  }

  return (
    <section aria-labelledby={titleId} className={surface}>
      {header}
      {children}
    </section>
  );
}
