/**
 * Répartition des mesures par qualité, en barres (EV-19).
 *
 * Le ticket demandait un composant Recharts **simple**, intégré à une page
 * réelle et hors chemin critique. Celui-ci répond à une question que le reste
 * de l'écran ne posait qu'en chiffres : sur la fenêtre affichée, combien de
 * mesures la source a-t-elle qualifiées de bonnes, et combien de dégradées ?
 *
 * Il n'appelle rien. Les mesures sont déjà chargées pour le graphique
 * principal, et `countByQuality` les résume : aucune requête n'est ajoutée
 * pour une information déjà en mémoire.
 *
 * Deux choix hérités du design system :
 *
 *   - les quatre catégories sont toujours dessinées, même à zéro. Une barre
 *     absente et une barre vide ne disent pas la même chose, et un graphique
 *     dont les catégories changent d'une fenêtre à l'autre se compare mal ;
 *   - la couleur suit la gravité mais ne la porte pas seule : chaque barre est
 *     nommée sur l'axe, et le nombre est écrit au bout.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartPoint } from "../lib/series";
import { countByQuality } from "../lib/series";
import { token } from "../ui/tokens";
import { EmptyState } from "../ui/states";

/** Libellés français des quatre qualifications du contrat. */
const QUALITY_LABELS: Record<NonNullable<ChartPoint["dataQuality"]>, string> = {
  good: "bonne",
  partial: "partielle",
  degraded: "dégradée",
  critical: "critique",
};

/**
 * Couleur de chaque catégorie.
 *
 * `mesure` pour ce qui est exploitable, `estimation` pour ce qui devient
 * douteux, `alerte` pour ce qui ne l'est plus : les trois familles disent la
 * même chose que les libellés, en plus rapide à parcourir.
 */
const QUALITY_TOKENS: Record<NonNullable<ChartPoint["dataQuality"]>, "mesure" | "estimation" | "grille"> =
  {
    good: "mesure",
    partial: "estimation",
    degraded: "estimation",
    critical: "grille",
  };

interface DataQualityBarChartProps {
  points: readonly ChartPoint[];
}

export function DataQualityBarChart({ points }: DataQualityBarChartProps) {
  const counts = countByQuality(points);
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);

  if (total === 0) {
    return (
      <EmptyState>Aucune mesure qualifiée sur la fenêtre : rien à répartir.</EmptyState>
    );
  }

  const data = counts.map((entry) => ({
    ...entry,
    label: QUALITY_LABELS[entry.quality],
  }));
  const description = `Répartition des ${total} mesures de la fenêtre par qualité annoncée par la source : ${data
    .map((entry) => `${entry.count} ${entry.label}`)
    .join(", ")}.`;

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{description}</figcaption>
      {/* `role="img"` avec la même description : le contenu SVG de Recharts
          n'est pas lisible autrement par une technologie d'assistance. */}
      <div className="h-40 w-full" role="img" aria-label={description}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 40, bottom: 4, left: 8 }}
          >
            <CartesianGrid stroke={token("grille")} strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
              stroke={token("axe")}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={80}
              stroke={token("axe")}
              tick={{ fontSize: 12 }}
            />
            {/* Les signatures de `formatter` de Recharts acceptent des valeurs
                absentes : on les traite plutôt que de forcer le type. */}
            <Tooltip
              formatter={(value) => [`${String(value ?? 0)} mesure(s)`, "Nombre"]}
              labelFormatter={(label) => `Qualité ${String(label ?? "")}`}
            />
            <Bar dataKey="count" name="Mesures" isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.quality} fill={token(QUALITY_TOKENS[entry.quality])} />
              ))}
              {/* Le nombre est écrit au bout de la barre : sur une fenêtre où
                  une catégorie écrase les autres, les petites barres seraient
                  illisibles à l'échelle. */}
              <LabelList
                dataKey="count"
                position="right"
                fill={token("axe")}
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
