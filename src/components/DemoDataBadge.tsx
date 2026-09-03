/**
 * Bandeau signalant qu'une série affichée ne vient pas d'un vrai backend.
 *
 * Il nomme la série concernée : une donnée simulée qui passerait pour une
 * mesure serait pire qu'un graphique vide. Le ton « avertissement » du design
 * system porte le sens par son libellé autant que par sa couleur.
 */

import { Alert } from "../ui/Alert";

/** Libellé du bandeau, partagé avec les tests. */
export const DEMO_BADGE_LABEL = "Données de démonstration";

interface DemoDataBadgeProps {
  /** Série effectivement simulée, nommée explicitement. */
  series: string;
  /** Raison de la simulation, avec le ticket qui la lèvera. */
  reason: string;
}

export function DemoDataBadge({ series, reason }: DemoDataBadgeProps) {
  return (
    <Alert tone="avertissement" label={DEMO_BADGE_LABEL}>
      {series} — {reason}
    </Alert>
  );
}
