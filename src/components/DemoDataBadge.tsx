/**
 * Bandeau signalant qu'une série affichée ne vient pas d'un vrai backend.
 *
 * Il est délibérément voyant et nomme la série concernée : une donnée simulée
 * qui passerait pour une mesure serait pire qu'un graphique vide.
 */

interface DemoDataBadgeProps {
  /** Série effectivement simulée, nommée explicitement. */
  series: string;
  /** Raison de la simulation, avec le ticket qui la lèvera. */
  reason: string;
}

export function DemoDataBadge({ series, reason }: DemoDataBadgeProps) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-amber-900"
    >
      <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-semibold tracking-wide uppercase">
        Données de démonstration
      </span>
      <span className="text-sm">
        {series} — {reason}
      </span>
    </div>
  );
}
