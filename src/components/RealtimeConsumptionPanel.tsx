/**
 * Panneau « Consommation temps réel » de la maquette.
 *
 * Une tuile principale pour la puissance instantanée, puis quatre tuiles
 * secondaires : tension, intensité, température, humidité. Toutes viennent de
 * la même `EnergyReadingOut`, celle de `GET /readings/latest`.
 *
 * Règle du guide d'intégration, appliquée sans exception ici : une valeur
 * `null` est une mesure absente, pas un zéro. Elle est affichée comme absente,
 * jamais remplacée par une valeur voisine ni par la valeur imputée — cette
 * dernière est calculée par l'ETL et n'a pas à passer pour un relevé.
 */

import type { EnergyReading } from "../api/readings";
import { isStale } from "../api/readings";

/** Libellé affiché à la place d'une mesure absente de la source. */
export const MISSING_VALUE = "—";

interface Metric {
  label: string;
  value: number | null;
  unit: string;
  /** Nombre de décimales, choisi selon la précision utile de la grandeur. */
  digits: number;
}

function format(metric: Metric): string {
  if (metric.value === null) {
    return MISSING_VALUE;
  }
  return `${metric.value.toLocaleString("fr-FR", {
    minimumFractionDigits: metric.digits,
    maximumFractionDigits: metric.digits,
  })} ${metric.unit}`;
}

function Tile({ metric, primary = false }: { metric: Metric; primary?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-slate-600 uppercase">
        {metric.label}
      </p>
      <p
        className={`mt-1 font-semibold text-slate-900 tabular-nums ${
          primary ? "text-3xl" : "text-xl"
        }`}
      >
        {format(metric)}
      </p>
    </div>
  );
}

interface RealtimeConsumptionPanelProps {
  reading: EnergyReading | null;
  isLoading: boolean;
  error: string | null;
  /** Injectable pour que les tests figent la fraîcheur sans horloge factice. */
  now?: Date;
}

export function RealtimeConsumptionPanel({
  reading,
  isLoading,
  error,
  now,
}: RealtimeConsumptionPanelProps) {
  return (
    <section
      aria-labelledby="realtime-heading"
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 id="realtime-heading" className="text-base font-semibold text-slate-900">
        Consommation temps réel
      </h2>

      {isLoading && (
        <p role="status" className="mt-4 text-sm text-slate-600">
          Chargement de la dernière mesure…
        </p>
      )}

      {!isLoading && error !== null && (
        <p role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}

      {!isLoading && error === null && reading === null && (
        <p className="mt-4 text-sm text-slate-600">
          Aucune mesure connue pour ce site.
        </p>
      )}

      {!isLoading && error === null && reading !== null && (
        <>
          <div className="mt-4 flex flex-col gap-3">
            <Tile
              primary
              metric={{
                label: "Consommation",
                value: reading.consumption_kw,
                unit: "kW",
                digits: 0,
              }}
            />
            <div className="grid grid-cols-2 gap-3">
              <Tile
                metric={{ label: "Tension", value: reading.voltage_v, unit: "V", digits: 1 }}
              />
              <Tile
                metric={{ label: "Intensité", value: reading.current_a, unit: "A", digits: 1 }}
              />
              <Tile
                metric={{
                  label: "Température",
                  value: reading.temperature_celsius,
                  unit: "°C",
                  digits: 1,
                }}
              />
              <Tile
                metric={{
                  label: "Humidité",
                  value: reading.humidity_percent,
                  unit: "%",
                  digits: 1,
                }}
              />
            </div>
          </div>

          <ul className="mt-4 flex flex-col gap-1 text-sm text-slate-600">
            <li>
              Relevé du{" "}
              <time dateTime={reading.timestamp}>
                {new Date(reading.timestamp).toLocaleString("fr-FR")}
              </time>
            </li>
            {isStale(reading, now) && (
              // Pas un role="alert" : c'est un état de la donnée, pas un
              // événement à interrompre la lecture. EV-18 portera le bandeau
              // de fraîcheur complet, par capteur.
              <li className="font-medium text-amber-800">
                Dernière mesure vieille de plus de deux minutes : l'ingestion est en retard.
              </li>
            )}
            {reading.consumption_kw === null && reading.consumption_kw_imputed !== null && (
              <li>
                Puissance absente de la source. L'ETL en a reconstitué une par{" "}
                {reading.imputation_method}, non affichée comme un relevé.
              </li>
            )}
            {reading.data_quality !== "good" && (
              <li>Qualité de la mesure annoncée par la source : {reading.data_quality}.</li>
            )}
            {reading.null_reasons.length > 0 && (
              <li>Motifs d'absence : {reading.null_reasons.join(", ")}.</li>
            )}
          </ul>
        </>
      )}
    </section>
  );
}
