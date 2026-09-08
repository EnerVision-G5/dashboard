/**
 * Graphique Recharts superposant consommation réelle et consommation prédite.
 *
 * La courbe réelle est pleine, la prédite en pointillés : la distinction tient
 * au tracé autant qu'à la couleur, pour rester lisible sans percevoir les
 * teintes.
 *
 * **Trois traits, pas deux.** La courbe réelle garde `connectNulls={false}` :
 * une mesure absente y laisse un trou, et le trait plein ne dit que ce qui a
 * été relevé. Un troisième trait, fin et pointillé, joint par-dessous la
 * dernière valeur connue à la suivante — sans lui, un parc où mille mesures
 * manquent sur vingt-quatre heures ne produit qu'une poussière de fragments
 * illisible.
 *
 * La distinction n'est donc pas abandonnée, elle est déplacée dans la forme :
 * plein pour le mesuré, pointillé fin et atténué pour le seulement joint, et
 * une entrée de légende qui le nomme.
 */

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartPoint } from "../lib/series";
import { valueDomain } from "../lib/series";
import type { Measure } from "../lib/measures";
import { formatMeasure, measureOf, seriesLabel } from "../lib/measures";
import { token } from "../ui/tokens";

/** Libellés des deux séries, partagés avec la légende et le survol. */
export const ACTUAL_SERIES_LABEL = "Consommation réelle (kW)";
export const PREDICTED_SERIES_LABEL = "Prédiction (kW)";


/**
 * Libellé du trait qui joint deux mesures séparées par un trou.
 *
 * Nommé « continuité » et non « consommation » : rien n'a été mesuré sur ce
 * segment, et la légende doit le dire aussi clairement que la forme du trait.
 */
export const BRIDGE_SERIES_LABEL = "Continuité (aucune mesure)";

/**
 * Couleurs des deux séries, lues sur les jetons du design system.
 *
 * Elles étaient écrites en dur, et l'étaient sur les valeurs de Tailwind v3
 * alors que le projet est passé en v4 : la courbe avait cessé d'avoir la
 * couleur des commandes de la même famille sans que personne le voie.
 */
const ACTUAL_COLOR = token("mesure");
const PREDICTED_COLOR = token("estimation");

const TIME_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
});

/** Jour et heure sans les minutes, pour les graduations d'une longue période. */
const DAY_HOUR_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
});

/**
 * Au-delà de deux jours, une graduation « 14:30 » devient ambiguë : elle peut
 * désigner cinq jours différents. Le format de l'axe suit donc la profondeur
 * réellement affichée (EV-53).
 */
const AMBIGUOUS_AFTER_HOURS = 48;

function axisFormatter(points: readonly ChartPoint[]): (value: number) => string {
  const first = points[0]?.timestamp;
  const last = points.at(-1)?.timestamp;
  const hours =
    first === undefined || last === undefined ? 0 : (last - first) / (60 * 60 * 1000);
  const format = hours > AMBIGUOUS_AFTER_HOURS ? DAY_HOUR_FORMAT : TIME_FORMAT;
  return (value: number) => format.format(new Date(value));
}

const QUALITY_LABELS: Record<NonNullable<ChartPoint["dataQuality"]>, string> = {
  good: "bonne",
  partial: "partielle",
  degraded: "dégradée",
  critical: "critique",
};

function formatKw(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)} kW`;
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
  /** Grandeur tracée, pour n'afficher que ce que la courbe montre. */
  measure?: Measure;
}

function SeriesTooltip({ active, payload, measure }: TooltipProps) {
  const point = payload?.[0]?.payload;
  const grandeur = measure ?? measureOf("consumption");
  if (active !== true || point === undefined) {
    return null;
  }

  return (
    <div className="rounded-md border border-slate-300 bg-white p-3 text-sm shadow-lg">
      <p className="font-medium text-slate-900">
        {DATE_TIME_FORMAT.format(new Date(point.timestamp))}
      </p>
      <p style={{ color: ACTUAL_COLOR }}>
        {seriesLabel(grandeur)} :{" "}
        {formatMeasure(point.values[grandeur.key], grandeur)}
      </p>
      {/* La prédiction n'est mentionnée que là où elle existe : sur une autre
          grandeur, une ligne « Prédiction : — » ferait croire à une valeur
          manquante plutôt qu'à une prévision qui n'a jamais été calculée. */}
      {grandeur.predicted && (
        <p style={{ color: PREDICTED_COLOR }}>
          {PREDICTED_SERIES_LABEL} : {formatKw(point.predictedKw)}
        </p>
      )}
      {point.dataQuality !== null && (
        <p className="text-slate-600">Qualité de la mesure : {QUALITY_LABELS[point.dataQuality]}</p>
      )}
      {point.actualKw === null && point.dataQuality !== null && (
        <p className="text-slate-600">
          Mesure absente de la source
          {point.imputedKw === null
            ? "."
            : ` — valeur reconstituée par l'ETL : ${formatKw(point.imputedKw)} (${point.imputationMethod}), non tracée.`}
        </p>
      )}
    </div>
  );
}

interface ConsumptionPredictionChartProps {
  points: readonly ChartPoint[];
  /** Description lue par les technologies d'assistance. */
  description: string;
  /**
   * Grandeur tracée. Par défaut la consommation, seule grandeur prédite.
   *
   * Sur les autres, la courbe de prédiction n'est pas masquée : le modèle ne
   * prévoit que la consommation, et le contrat ne publie rien d'autre.
   */
  measure?: Measure;
}

export function ConsumptionPredictionChart({
  points,
  description,
  measure,
}: ConsumptionPredictionChartProps) {
  const formatTick = axisFormatter(points);
  const grandeur = measure ?? measureOf("consumption");
  const dataKey = `values.${grandeur.key}`;

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{description}</figcaption>
      <div className="h-80 w-full sm:h-96" role="img" aria-label={description}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points as ChartPoint[]} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke={token("grille")} strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={formatTick}
              stroke={token("axe")}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              domain={valueDomain(points, grandeur.key)}
              // Les bornes sont calculées : les laisser s'étendre à un nombre
              // « rond » les ramènerait vers zéro et annulerait le cadrage.
              allowDataOverflow={false}
              stroke={token("axe")}
              tick={{ fontSize: 12 }}
              width={64}
              label={{
                value: grandeur.unit === "" ? grandeur.label : grandeur.unit,
                angle: -90,
                position: "insideLeft",
                fill: token("axe"),
              }}
            />
            <Tooltip content={<SeriesTooltip measure={grandeur} />} />
            <Legend />
            {/* Pontage des trous, tracé EN PREMIER donc sous la courbe réelle.
                Sur le parc actuel, plus de mille mesures manquent sur une
                fenêtre de vingt-quatre heures : sans ce trait, la courbe se
                réduit à une poussière de fragments illisible.

                Il relie la dernière valeur connue à la suivante — et il le dit,
                par un pointillé fin et sa propre entrée de légende. Combler un
                trou avec le trait plein de la mesure aurait affirmé une
                continuité que personne n'a relevée ; ici, la forme distingue ce
                qui est mesuré de ce qui est seulement joint. */}
            <Line
              className="serie-pontage"
              type="monotone"
              dataKey={dataKey}
              name={BRIDGE_SERIES_LABEL}
              stroke={ACTUAL_COLOR}
              strokeOpacity={0.45}
              strokeWidth={1}
              strokeDasharray="2 4"
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              className="serie-mesuree"
              type="monotone"
              dataKey={dataKey}
              name={seriesLabel(grandeur)}
              stroke={ACTUAL_COLOR}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            {/* Une seule grandeur est prédite : ailleurs, cette courbe
                n'existe pas, et l'afficher vide laisserait croire à une
                prévision manquante. */}
            {grandeur.predicted && (
              <Line
                className="serie-predite"
                type="monotone"
                dataKey="predictedKw"
                name={PREDICTED_SERIES_LABEL}
                stroke={PREDICTED_COLOR}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
