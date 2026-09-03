/**
 * Les quatre états, en un seul vocabulaire (EV-47).
 *
 * Le ticket demande que chargement, erreur, vide et désactivé soient prévus.
 * Ils sont traités ici comme un sujet transverse, et non comme une propriété
 * de chaque composant : sans quoi chaque écran réinvente sa façon de dire
 * « ça charge ».
 *
 * Règle commune : un état dit toujours de quoi il parle. Un rond qui tourne
 * sans légende, un « Aucune donnée » sec, un bouton grisé sans raison sont
 * trois façons de laisser l'utilisateur seul devant un écran qui ne répond
 * pas.
 *
 * Le quatrième état, « désactivé », n'a pas de composant : il est porté par
 * l'attribut `disabled` des commandes, que `Button` et les champs traitent
 * déjà.
 */

import type { ReactNode } from "react";

/**
 * Chargement.
 *
 * `role="status"` plutôt que `role="alert"` : l'attente n'interrompt pas la
 * lecture, elle est annoncée poliment quand le lecteur d'écran en a le temps.
 */
export function LoadingState({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="text-corps text-ardoise-600">
      {children}
    </p>
  );
}

interface ErrorStateProps {
  /** Ce qui a échoué, en quelques mots. */
  title: string;
  /** Le détail, repris tel quel de l'API quand il apporte une information. */
  children: ReactNode;
}

/**
 * Erreur.
 *
 * `role="alert"` : un échec interrompt, il est annoncé immédiatement.
 * La couleur est doublée par le titre, jamais seule à porter le sens.
 */
export function ErrorState({ title, children }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-surface border border-alerte-300 bg-alerte-50 p-4 text-alerte-900"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 text-corps">{children}</p>
    </div>
  );
}

interface EmptyStateProps {
  /** Pourquoi c'est vide. « Aucune donnée » n'est pas une réponse. */
  children: ReactNode;
  /** Ce qui lèvera le vide : un ticket, une action, une attente. */
  detail?: ReactNode;
}

/**
 * Vide.
 *
 * Distingue « rien à afficher » de « pas encore alimenté » : ce n'est pas la
 * même chose pour qui regarde, et la seconde formulation évite d'ouvrir un
 * incident pour un service qui n'existe pas encore.
 */
export function EmptyState({ children, detail }: EmptyStateProps) {
  return (
    <div className="text-corps text-ardoise-600">
      <p>{children}</p>
      {detail !== undefined && <p className="mt-2 text-ardoise-500">{detail}</p>}
    </div>
  );
}
