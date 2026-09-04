/**
 * Panneau « Consommation temps réel » de la maquette.
 *
 * Une tuile principale pour la puissance instantanée, puis quatre tuiles
 * secondaires : tension, intensité, température, humidité. Toutes viennent de
 * la même `EnergyReadingOut`, celle de `GET /readings/latest`.
 *
 * Le formatage et la règle de l'absence sont portés par `MetricTile` : ce
 * panneau n'a plus qu'à dire quelle grandeur va dans quelle tuile, et à
 * commenter la qualité de la mesure sous la grille.
 */

import type { EnergyReading } from "../api/readings";
import { isStale } from "../api/readings";
import { Card } from "../ui/Card";
import { MetricTile } from "../ui/MetricTile";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";

interface RealtimeConsumptionPanelProps {
  reading: EnergyReading | null;
  isLoading: boolean;
  error: string | null;
  /** Injectable pour que les tests figent la fraîcheur sans horloge factice. */
  now?: Date;
}

/** Grandeurs secondaires, dans l'ordre de la maquette. */
function secondaryMetrics(reading: EnergyReading) {
  return [
    { label: "Tension", value: reading.voltage_v, unit: "V" },
    { label: "Intensité", value: reading.current_a, unit: "A" },
    { label: "Température", value: reading.temperature_celsius, unit: "°C" },
    { label: "Humidité", value: reading.humidity_percent, unit: "%" },
  ];
}

/** Commentaires sur la provenance et la qualité de la mesure affichée. */
function Notes({ reading, now }: { reading: EnergyReading; now?: Date }) {
  return (
    <ul className="mt-4 flex flex-col gap-1 text-corps text-ardoise-600">
      <li>
        Relevé du{" "}
        <time dateTime={reading.timestamp}>
          {new Date(reading.timestamp).toLocaleString("fr-FR")}
        </time>
      </li>
      {isStale(reading, now) && (
        // Pas un role="alert" : c'est un état de la donnée, pas un événement
        // qui doit interrompre la lecture. Le bandeau de fraîcheur complet,
        // par capteur, relève d'EV-18.
        <li className="font-medium text-estimation-800">
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
  );
}

export function RealtimeConsumptionPanel({
  reading,
  isLoading,
  error,
  now,
}: RealtimeConsumptionPanelProps) {
  return (
    <Card title="Consommation temps réel">
      {isLoading && <LoadingState>Chargement de la dernière mesure…</LoadingState>}

      {!isLoading && error !== null && (
        <ErrorState title="Mesure temps réel indisponible">{error}</ErrorState>
      )}

      {!isLoading && error === null && reading === null && (
        <EmptyState>Aucune mesure connue pour ce site.</EmptyState>
      )}

      {!isLoading && error === null && reading !== null && (
        <>
          <div className="flex flex-col gap-3">
            <MetricTile
              label="Consommation"
              value={reading.consumption_kw}
              unit="kW"
              digits={0}
              emphasis="principal"
            />
            {/* Deux colonnes dès qu'il y a la place : sur un téléphone, quatre
                tuiles côte à côte deviennent illisibles. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {secondaryMetrics(reading).map((metric) => (
                <MetricTile key={metric.label} {...metric} />
              ))}
            </div>
          </div>
          <Notes reading={reading} now={now} />
        </>
      )}
    </Card>
  );
}
