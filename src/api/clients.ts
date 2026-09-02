/**
 * Instances Axios des services appelés par le dashboard.
 *
 * Les clients sont mémorisés par URL de base : recréer une instance à chaque
 * rendu relancerait inutilement la configuration d'Axios.
 */

import type { AxiosInstance } from "axios";
import { getApiBaseUrl, getPredictBaseUrl } from "../config/env";
import { createHttpClient } from "./http";

const clientsByBaseUrl = new Map<string, AxiosInstance>();

function clientFor(baseUrl: string): AxiosInstance {
  const existing = clientsByBaseUrl.get(baseUrl);
  if (existing !== undefined) {
    return existing;
  }
  const created = createHttpClient(baseUrl);
  clientsByBaseUrl.set(baseUrl, created);
  return created;
}

/** Client de l'API métier (sites et mesures). */
export function getApiClient(): AxiosInstance {
  return clientFor(getApiBaseUrl());
}

/** Client du service d'inférence. */
export function getPredictClient(): AxiosInstance {
  return clientFor(getPredictBaseUrl());
}
