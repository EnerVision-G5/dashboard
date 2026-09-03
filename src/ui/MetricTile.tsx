/**
 * Tuile de mesure (EV-47).
 *
 * Le seul composant réellement propre au métier, et le plus utile à extraire :
 * il applique à lui seul deux règles du système, ce qui garantit qu'on ne les
 * oubliera pas au dixième écran.
 *
 *   1. Une valeur absente s'affiche « — », jamais « 0 ». Zéro est une mesure ;
 *      l'absence n'en est pas une. Le composant n'accepte donc pas de valeur de
 *      repli : `null` entre, tiret cadratin sort.
 *   2. Le nombre est en chiffres tabulaires. Sans cela, un « 1 » plus étroit
 *      qu'un « 8 » fait tressauter la ligne à chaque rafraîchissement — sur un
 *      panneau qui se rafraîchit toutes les trente secondes, ce frémissement
 *      permanent donne l'impression que la valeur est instable alors qu'elle
 *      ne l'est pas.
 */

/** Libellé affiché à la place d'une mesure absente de la source. */
export const MISSING_VALUE = "—";

/** Place de la tuile dans la hiérarchie du panneau. */
export type MetricEmphasis = "principal" | "secondaire";

interface MetricTileProps {
  /** Grandeur mesurée, en capitales dans la tuile. */
  label: string;
  /** Valeur brute. `null` signifie « absente de la source », et le reste. */
  value: number | null;
  /** Unité, accolée à la valeur. */
  unit: string;
  /** Décimales, selon la précision utile de la grandeur. */
  digits?: number;
  emphasis?: MetricEmphasis;
}

function format(value: number | null, unit: string, digits: number): string {
  if (value === null) {
    return MISSING_VALUE;
  }
  const nombre = value.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${nombre} ${unit}`;
}

export function MetricTile({
  label,
  value,
  unit,
  digits = 1,
  emphasis = "secondaire",
}: MetricTileProps) {
  const principal = emphasis === "principal";

  return (
    <div className="rounded-controle border border-ardoise-200 bg-ardoise-50 px-4 py-3">
      <p className="text-annexe font-medium tracking-wide text-ardoise-600 uppercase">{label}</p>
      {/* `output` porte les chiffres tabulaires par défaut, posés dans
          index.css : la règle tient même si quelqu'un oublie la classe. */}
      <output
        className={`mt-1 block font-semibold text-ardoise-900 ${
          principal ? "text-valeur-xl" : "text-valeur-l"
        }`}
      >
        {format(value, unit, digits)}
      </output>
    </div>
  );
}
