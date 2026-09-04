/**
 * Doubles de test partagés : client HTTP factice et jeux de données conformes
 * aux contrats gelés.
 *
 * Ces doubles n'existent que pour les tests. Le chemin de production n'a aucun
 * repli implicite vers eux : une panne réseau y produit une erreur, jamais une
 * donnée inventée.
 */

import type { AxiosInstance } from "axios";
import type { SiteIndicators } from "../api/indicators";
import type { SensorFailure, SensorHealth } from "../api/sensors";
import type { EnergyReading } from "../api/readings";
import type {
  Prediction,
  PredictionPoint,
  PredictionsPage,
} from "../api/predictions";
import type { Site } from "../api/sites";

/** Appel enregistré par le client factice. */
export interface RecordedCall {
  method: "get" | "post";
  url: string;
  params?: Record<string, unknown>;
  body?: unknown;
}

/** Réponse programmée pour un appel. */
export type Responder = (call: RecordedCall) => unknown;

/**
 * Client HTTP factice exposant la surface d'`AxiosInstance` réellement
 * utilisée par `src/api` (`get` et `post`).
 */
export interface FakeClient {
  instance: AxiosInstance;
  calls: RecordedCall[];
}

export function createFakeClient(respond: Responder): FakeClient {
  const calls: RecordedCall[] = [];

  const handle = (call: RecordedCall) => {
    calls.push(call);
    const result = respond(call);
    return result instanceof Promise
      ? result.then((data) => ({ data }))
      : Promise.resolve({ data: result });
  };

  const instance = {
    get: (url: string, config?: { params?: Record<string, unknown> }) =>
      handle({ method: "get", url, params: config?.params }),
    post: (url: string, body?: unknown) => handle({ method: "post", url, body }),
  } as unknown as AxiosInstance;

  return { instance, calls };
}

/** Site conforme à `SiteOut`, personnalisable champ par champ. */
export function makeSite(overrides: Partial<Site> = {}): Site {
  return {
    site_id: "SITE-001",
    site_name: "Usine Nantes Nord",
    site_type: "usine",
    location: "Nantes",
    capacity_kw: 500,
    status: "active",
    ...overrides,
  };
}

/** Mesure conforme à `EnergyReadingOut`, personnalisable champ par champ. */
export function makeReading(overrides: Partial<EnergyReading> = {}): EnergyReading {
  return {
    timestamp: "2026-09-02T00:00:00Z",
    site_id: "SITE-001",
    site_type: "usine",
    consumption_kw: 120,
    consumption_kwh: 2,
    consumption_kw_imputed: null,
    voltage_v: 400,
    current_a: 180,
    power_factor: 0.95,
    temperature_celsius: 21,
    humidity_percent: 45,
    null_reasons: [],
    data_quality: "good",
    imputation_method: "none",
    // Contrat 1.5.0 : une mesure peut être écartée des agrégats, avec son
    // motif. Le double part d'une mesure retenue, l'exclusion étant l'exception.
    excluded: false,
    exclusion_reason: null,
    ...overrides,
  };
}

/** Point conforme à `PredictionPointOut`, tel que l'API le publie. */
export function makePredictionPoint(
  overrides: Partial<PredictionPoint> = {},
): PredictionPoint {
  return {
    timestamp: "2026-09-02T01:00:00Z",
    predicted_consumption_kw: 130,
    lower_bound_kw: null,
    upper_bound_kw: null,
    // Chaque point porte sa provenance : la route sert des lignes plates.
    model_version: "test-1",
    generated_at: "2026-09-02T00:00:00Z",
    ...overrides,
  };
}

/** Série recomposée, telle que `fetchPredictions` la rend. */
export function makePrediction(overrides: Partial<Prediction> = {}): Prediction {
  return {
    siteId: "SITE-001",
    modelVersion: "test-1",
    generatedAt: "2026-09-02T00:00:00Z",
    points: [makePredictionPoint()],
    ...overrides,
  };
}

/**
 * Indicateurs de confiance d'un site, tels que le contrat 1.5.0 les publie.
 *
 * Le double part d'un site sain : fenêtre fraîche, entièrement qualifiée,
 * aucune dégradation. Chaque test n'écrase donc que ce qu'il veut démontrer.
 */
export function makeSiteIndicators(
  overrides: Partial<SiteIndicators> = {},
): SiteIndicators {
  return {
    site_id: "SITE-001",
    generated_at: "2026-09-02T12:00:00Z",
    window_hours: 24,
    ingestion: {
      last_measure_at: "2026-09-02T11:59:00Z",
      last_ingested_at: "2026-09-02T11:59:30Z",
      measure_age_seconds: 60,
      ingestion_lag_seconds: 30,
      is_stale: false,
      stale_threshold_seconds: 300,
      collector: null,
      ...overrides.ingestion,
    },
    quality: {
      window_start: "2026-09-01T12:00:00Z",
      window_end: "2026-09-02T12:00:00Z",
      total: 1440,
      qualified: 1440,
      qualified_ratio: 1,
      not_good: 0,
      degraded: 0,
      imputed: 0,
      sensor_failure: 0,
      degraded_ratio: 0,
      threshold: 0.1,
      exceeds_threshold: false,
      ...overrides.quality,
    },
    accuracy: {
      window_start: "2026-09-01T12:00:00Z",
      window_end: "2026-09-02T12:00:00Z",
      paired_points: 24,
      bounded_points: 24,
      mae_kw: 8,
      bias_kw: -2,
      mean_actual_kw: 120,
      within_bounds_ratio: 0.9,
      drift: false,
      drift_threshold_ratio: 0.2,
      model_versions: ["test-1"],
      ...overrides.accuracy,
    },
    ...overrides,
  };
}

/** État d'un capteur, tel que la source le déclare. */
export function makeSensorHealth(
  overrides: Partial<SensorHealth> = {},
): SensorHealth {
  return {
    site_id: "SITE-001",
    capteur: "consumption",
    statut: "ok",
    overall: "ok",
    releve_le: "2026-09-02T11:59:00Z",
    failing_until: null,
    ...overrides,
  };
}

/** Épisode de panne de capteur, tel que l'API le borne. */
export function makeSensorFailure(
  overrides: Partial<SensorFailure> = {},
): SensorFailure {
  return {
    site_id: "SITE-001",
    capteur: "temperature",
    started_at: "2026-09-02T08:00:00Z",
    ended_at: "2026-09-02T09:30:00Z",
    failing_until: null,
    ongoing: false,
    ...overrides,
  };
}

/** Page de prédictions, telle que le contrat la renvoie. */
export function makePredictionsPage(
  points: PredictionPoint[] = [makePredictionPoint()],
): PredictionsPage {
  return {
    items: points,
    meta: { total: points.length, limit: 1000, offset: 0 },
  };
}
