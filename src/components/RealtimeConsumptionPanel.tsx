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
import { formatAge } from "../lib/dataHealth";
import { Card } from "../ui/Card";
import { MetricTile } from "../ui/MetricTile";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";

interface RealtimeConsumptionPanelProps {
  reading: EnergyReading | null;
  isLoading: boolean;
  error: string | null;
  /** Injectable pour que les tests figent la fraîcheur sans horloge factice. */
  now?: Date;
  /**
   * Seuil de retard servi par l'API, en secondes (EV-52).
   *
   * Absent, le panneau retombe sur le seuil du guide d'intégration écrit dans
   * `src/api/readings.ts`. Il vaut mieux le recevoir : deux seuils différents
   * sur le même écran — celui-ci et celui du bandeau de fraîcheur — finiraient
   * par se contredire.
   */
  staleThresholdSeconds?: number;
  /**
   * Disposition des tuiles.
   *
   * `bande` range les cinq valeurs sur une ligne, pour la pleine largeur de
   * l'écran de supervision : ce sont cinq nombres courts, et les empiler dans
   * une colonne d'un tiers de largeur occupait une hauteur d'écran pour rien.
   * `colonne` garde la disposition de la maquette d'origine.
   */
  layout?: "bande" | "colonne";
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
function Notes({
  reading,
  now,
  staleThresholdSeconds,
}: {
  reading: EnergyReading;
  now?: Date;
  staleThresholdSeconds?: number;
}) {
  const thresholdMs =
    staleThresholdSeconds === undefined ? undefined : staleThresholdSeconds * 1000;

  return (
    <ul className="mt-4 flex flex-col gap-1 text-corps text-ardoise-600">
      <li>
        Relevé du{" "}
        <time dateTime={reading.timestamp}>
          {new Date(reading.timestamp).toLocaleString("fr-FR")}
        </time>
      </li>
      {isStale(reading, now, thresholdMs) && (
        // Pas un role="alert" : c'est un état de la donnée, pas un événement
        // qui doit interrompre la lecture. Le bandeau d'EV-18 porte déjà
        // l'annonce, à l'échelle du parc.
        <li className="font-medium text-estimation-800">
          {staleThresholdSeconds === undefined
            ? "Dernière mesure vieille de plus de deux minutes : l'ingestion est en retard."
            : `Dernière mesure plus vieille que le seuil de ${formatAge(staleThresholdSeconds)} servi par l'API : l'ingestion est en retard.`}
        </li>
      )}
      {/* Le contrat 1.5.0 sert des mesures écartées des agrégats sans les
          cacher : les taire ici laisserait croire que la valeur affichée
          compte dans les moyennes de l'API. */}
      {reading.excluded === true && (
        <li className="font-medium text-estimation-800">
          Mesure écartée des calculs agrégés
          {reading.exclusion_reason === null || reading.exclusion_reason === undefined
            ? ", sans motif précisé par la source"
            : ` : ${reading.exclusion_reason}`}
          . Elle reste affichée telle qu'elle a été relevée.
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
  staleThresholdSeconds,
  layout = "colonne",
}: RealtimeConsumptionPanelProps) {
  const enBande = layout === "bande";
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
          {enBande ? (
            // Cinq tuiles sur une ligne dès qu'il y a la place ; deux par
            // ligne sur un téléphone, où cinq deviendraient illisibles.
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <MetricTile
                label="Consommation"
                value={reading.consumption_kw}
                unit="kW"
                digits={0}
                emphasis="principal"
              />
              {secondaryMetrics(reading).map((metric) => (
                <MetricTile key={metric.label} {...metric} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <MetricTile
                label="Consommation"
                value={reading.consumption_kw}
                unit="kW"
                digits={0}
                emphasis="principal"
              />
              {/* Deux colonnes dès qu'il y a la place : sur un téléphone,
                  quatre tuiles côte à côte deviennent illisibles. */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {secondaryMetrics(reading).map((metric) => (
                  <MetricTile key={metric.label} {...metric} />
                ))}
              </div>
            </div>
          )}
          <Notes
            reading={reading}
            now={now}
            staleThresholdSeconds={staleThresholdSeconds}
          />
        </>
      )}
    </Card>
  );
}
