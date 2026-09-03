/**
 * Client HTTP partagé : création des instances Axios et normalisation des
 * erreurs en messages affichables.
 *
 * Les fonctions métier de `src/api` ne manipulent jamais Axios directement,
 * elles reçoivent un client. Cela garde les URL, le délai d'attente et le
 * format d'erreur en un seul endroit, et rend les appels testables sans
 * serveur.
 */

import axios, { type AxiosInstance } from "axios";

/** Délai au-delà duquel un appel est considéré comme perdu. */
export const REQUEST_TIMEOUT_MS = 15_000;

/** Erreur d'appel normalisée, porteuse d'un message destiné à l'utilisateur. */
export class ApiError extends Error {
  /** Code HTTP renvoyé, `null` si la réponse n'est jamais arrivée. */
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Crée une instance Axios configurée pour un service du contrat. */
export function createHttpClient(baseUrl: string): AxiosInstance {
  return axios.create({
    baseURL: baseUrl,
    timeout: REQUEST_TIMEOUT_MS,
    headers: { Accept: "application/json" },
  });
}

/** Vrai si l'erreur provient d'une requête annulée volontairement. */
export function isCancellation(error: unknown): boolean {
  return axios.isCancel(error) || (error instanceof Error && error.name === "CanceledError");
}

/**
 * Extrait le `detail` du corps d'erreur commun aux deux contrats.
 *
 * Le champ est typé `ErrorResponse` côté OpenAPI, mais un proxy ou un serveur
 * en panne peut renvoyer autre chose : la lecture reste défensive.
 */
function readDetail(data: unknown): string | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const detail = (data as { detail?: unknown }).detail;
  return typeof detail === "string" && detail.trim() !== "" ? detail.trim() : null;
}

function describe(service: string, status: number, detail: string | null): string {
  switch (status) {
    case 401:
      return `${service} exige une authentification (401). L'authentification du dashboard relève d'EV-12.`;
    case 404:
      return detail ?? `Ressource inconnue de ${service} (404).`;
    case 422:
      return `Requête refusée par ${service} (422) : ${detail ?? "paramètres invalides."}`;
    case 501:
      return `${service} n'implémente pas encore cet endpoint (501). ${detail ?? ""}`.trim();
    case 503:
      return `${service} est temporairement indisponible (503). ${detail ?? ""}`.trim();
    default:
      return status >= 500
        ? `${service} a renvoyé une erreur serveur (${status}).`
        : `${service} a refusé la requête (${status}). ${detail ?? ""}`.trim();
  }
}

/**
 * Traduit n'importe quelle erreur d'appel en `ApiError` affichable.
 *
 * `service` nomme le service appelé pour que l'utilisateur sache lequel des
 * deux backends est en cause.
 */
export function toApiError(error: unknown, service: string): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (axios.isAxiosError(error)) {
    if (error.response !== undefined) {
      const { status, data } = error.response;
      return new ApiError(describe(service, status, readDetail(data)), status);
    }
    if (error.code === "ECONNABORTED") {
      return new ApiError(
        `${service} n'a pas répondu dans le délai imparti (${REQUEST_TIMEOUT_MS / 1000} s).`,
        null,
      );
    }
    return new ApiError(
      `${service} est injoignable. Vérifier que le service tourne et que son adresse est correcte.`,
      null,
    );
  }
  const reason = error instanceof Error ? error.message : String(error);
  return new ApiError(`Appel à ${service} impossible : ${reason}`, null);
}
