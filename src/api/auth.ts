/**
 * Délivrance du jeton par l'API métier (EV-12 côté serveur, EV-48 côté écran).
 *
 * Flux OAuth2 mot de passe : le couple identifiant / mot de passe part en
 * formulaire `application/x-www-form-urlencoded`, comme l'exige
 * `OAuth2PasswordRequestForm` côté FastAPI. Un envoi en JSON serait refusé en
 * 422 par le contrat.
 *
 * Le mot de passe ne traverse ce module qu'une fois, le temps de l'appel : il
 * n'est ni conservé, ni journalisé, ni replacé dans un état React.
 */

import type { AxiosInstance } from "axios";
import type { components } from "../types/api";
import { API_SERVICE_LABEL } from "./sites";
import { ApiError, toApiError } from "./http";

/** Jeton délivré par le contrat gelé. */
export type TokenResponse = components["schemas"]["TokenResponse"];

/** Chemin du flux OAuth2 mot de passe dans le contrat gelé. */
export const TOKEN_PATH = "/api/v1/auth/token";

/**
 * Message affiché sur un refus d'identifiants.
 *
 * L'API répond volontairement la même chose pour un compte inconnu et pour un
 * mot de passe faux, afin qu'on ne puisse pas énumérer les comptes. Le
 * dashboard tient la même ligne et n'ajoute aucune précision.
 */
export const INVALID_CREDENTIALS_MESSAGE =
  "Identifiants invalides. Vérifier l'identifiant et le mot de passe.";

interface RequestTokenOptions {
  client: AxiosInstance;
  username: string;
  password: string;
  signal?: AbortSignal;
}

/**
 * Échange un couple identifiant / mot de passe contre un jeton.
 *
 * Le 401 est traduit ici plutôt que par `toApiError` : sur cet écran, il ne
 * signifie pas « session expirée » mais « identifiants refusés », et c'est le
 * seul endroit de l'application où cette lecture est la bonne.
 */
export async function requestToken({
  client,
  username,
  password,
  signal,
}: RequestTokenOptions): Promise<TokenResponse> {
  // URLSearchParams produit le corps et le Content-Type attendus par le
  // contrat sans qu'on ait à les écrire à la main.
  const form = new URLSearchParams({ username, password });

  try {
    const response = await client.post<TokenResponse>(TOKEN_PATH, form, {
      signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return response.data;
  } catch (error) {
    const apiError = toApiError(error, API_SERVICE_LABEL);
    if (apiError.status === 401) {
      throw new ApiError(INVALID_CREDENTIALS_MESSAGE, 401);
    }
    throw apiError;
  }
}
