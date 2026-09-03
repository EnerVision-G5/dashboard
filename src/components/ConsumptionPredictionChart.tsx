/**
 * Graphique Recharts superposant consommation réelle et consommation prédite.
 *
 * La courbe réelle est pleine, la prédite en pointillés : la distinction tient
 * au tracé autant qu'à la couleur, pour rester lisible sans percevoir les
 * teintes. `connectNulls` reste à `false` afin qu'une mesure absente laisse un
 * trou visible plutôt qu'un segment inventé.
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

/** Libellés des deux séries, partagés avec la légende et le survol. */
export const ACTUAL_SERIES_LABEL = "Consommation réelle (kW)";
export const PREDICTED_SERIES_LABEL = "Prédiction (kW)";

const ACTUAL_COLOR = "#0f766e";
const PREDICTED_COLOR = "#b45309";

const TIME_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
});

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
}

function SeriesTooltip({ active, payload }: TooltipProps) {
  const point = payload?.[0]?.payload;
  if (active !== true || point === undefined) {
    return null;
  }

  return (
    <div className="rounded-md border border-slate-300 bg-white p-3 text-sm shadow-lg">
      <p className="font-medium text-slate-900">
        {DATE_TIME_FORMAT.format(new Date(point.timestamp))}
      </p>
      <p style={{ color: ACTUAL_COLOR }}>
        {ACTUAL_SERIES_LABEL} : {formatKw(point.actualKw)}
      </p>
      <p style={{ color: PREDICTED_COLOR }}>
        {PREDICTED_SERIES_LABEL} : {formatKw(point.predictedKw)}
      </p>
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
}

export function ConsumptionPredictionChart({
  points,
  description,
}: ConsumptionPredictionChartProps) {
  return (
    <figure className="m-0">
      <figcaption className="sr-only">{description}</figcaption>
      <div className="h-80 w-full sm:h-96" role="img" aria-label={description}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points as ChartPoint[]} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(value: number) => TIME_FORMAT.format(new Date(value))}
              stroke="#475569"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              stroke="#475569"
              tick={{ fontSize: 12 }}
              width={64}
              label={{ value: "kW", angle: -90, position: "insideLeft", fill: "#475569" }}
            />
            <Tooltip content={<SeriesTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="actualKw"
              name={ACTUAL_SERIES_LABEL}
              stroke={ACTUAL_COLOR}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
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
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
