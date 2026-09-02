/**
 * Fusion des mesures et de la prévision en une série unique pour Recharts.
 *
 * Fonction pure, sans DOM ni horloge : c'est la pièce où se joue la fidélité
 * des données, elle doit être vérifiable isolément.
 *
 * Trois règles y sont tenues :
 *   - un `consumption_kw` nul reste nul, il n'est ni comblé ni remplacé par la
 *     valeur imputée ; le graphique laissera un trou ;
 *   - `consumption_kw_imputed` est transporté à part, pour le survol, et n'est
 *     jamais tracé comme une mesure réelle ;
 *   - aucun point n'est fabriqué pour relier la dernière mesure à la première
 *     prédiction : les deux courbes ne se rejoignent que si le contrat renvoie
 *     réellement le même horodatage.
 */

import type { EnergyReading } from "../api/readings";
import type { PredictionPoint } from "../api/predictions";

/** Point de la série affichée, tous champs optionnels résolus à `null`. */
export interface ChartPoint {
  /** Horodatage en millisecondes depuis l'epoch, pour l'axe temporel numérique. */
  timestamp: number;
  /** Horodatage d'origine, ISO 8601 UTC. */
  isoTimestamp: string;
  /** Consommation réellement mesurée, `null` si la source ne l'a pas fournie. */
  actualKw: number | null;
  /** Consommation prédite par le service d'inférence. */
  predictedKw: number | null;
  /** Valeur reconstituée par l'ETL, affichée en information seulement. */
  imputedKw: number | null;
  /** Qualification de la mesure par la source. */
  dataQuality: EnergyReading["data_quality"] | null;
  /** Méthode d'imputation appliquée par l'ETL. */
  imputationMethod: EnergyReading["imputation_method"] | null;
  /** Borne basse de l'intervalle de confiance, `null` si non calculée. */
  lowerBoundKw: number | null;
  /** Borne haute de l'intervalle de confiance, `null` si non calculée. */
  upperBoundKw: number | null;
}

function emptyPoint(isoTimestamp: string, timestamp: number): ChartPoint {
  return {
    timestamp,
    isoTimestamp,
    actualKw: null,
    predictedKw: null,
    imputedKw: null,
    dataQuality: null,
    imputationMethod: null,
    lowerBoundKw: null,
    upperBoundKw: null,
  };
}

/**
 * Fusionne mesures et prédictions par horodatage, triées par ordre croissant.
 *
 * Un horodatage illisible est ignoré plutôt que converti en `NaN`, qui
 * casserait l'axe temporel.
 */
export function buildChartSeries(
  readings: readonly EnergyReading[],
  predictionPoints: readonly PredictionPoint[],
): ChartPoint[] {
  const byTimestamp = new Map<number, ChartPoint>();

  const pointAt = (isoTimestamp: string): ChartPoint | null => {
    const timestamp = Date.parse(isoTimestamp);
    if (Number.isNaN(timestamp)) {
      return null;
    }
    const existing = byTimestamp.get(timestamp);
    if (existing !== undefined) {
      return existing;
    }
    const created = emptyPoint(isoTimestamp, timestamp);
    byTimestamp.set(timestamp, created);
    return created;
  };

  for (const reading of readings) {
    const point = pointAt(reading.timestamp);
    if (point === null) {
      continue;
    }
    point.actualKw = reading.consumption_kw;
    point.imputedKw = reading.consumption_kw_imputed;
    point.dataQuality = reading.data_quality;
    point.imputationMethod = reading.imputation_method;
  }

  for (const prediction of predictionPoints) {
    const point = pointAt(prediction.timestamp);
    if (point === null) {
      continue;
    }
    point.predictedKw = prediction.predicted_consumption_kw;
    point.lowerBoundKw = prediction.lower_bound_kw;
    point.upperBoundKw = prediction.upper_bound_kw;
  }

  return [...byTimestamp.values()].sort((left, right) => left.timestamp - right.timestamp);
}

/** Nombre de mesures dont la consommation réelle est absente. */
export function countMissingReadings(points: readonly ChartPoint[]): number {
  return points.filter((point) => point.dataQuality !== null && point.actualKw === null).length;
}
