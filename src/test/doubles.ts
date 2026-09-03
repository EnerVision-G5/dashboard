/**
 * Doubles de test partagés : client HTTP factice et jeux de données conformes
 * aux contrats gelés.
 *
 * Ces doubles n'existent que pour les tests. Le chemin de production n'a aucun
 * repli implicite vers eux : une panne réseau y produit une erreur, jamais une
 * donnée inventée.
 */

import type { AxiosInstance } from "axios";
import type { EnergyReading } from "../api/readings";
import type { Prediction, PredictionPoint } from "../api/predictions";
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
    ...overrides,
  };
}

/** Point conforme à `PredictionPoint`. */
export function makePredictionPoint(
  overrides: Partial<PredictionPoint> = {},
): PredictionPoint {
  return {
    timestamp: "2026-09-02T01:00:00Z",
    predicted_consumption_kw: 130,
    lower_bound_kw: null,
    upper_bound_kw: null,
    ...overrides,
  };
}

/** Prévision conforme à `PredictionOut`. */
export function makePrediction(overrides: Partial<Prediction> = {}): Prediction {
  return {
    site_id: "SITE-001",
    model_version: "test-1",
    generated_at: "2026-09-02T00:00:00Z",
    points: [makePredictionPoint()],
    ...overrides,
  };
}
