/**
 * Instances Axios des services appelés par le dashboard.
 *
 * Les clients sont mémorisés par URL de base : recréer une instance à chaque
 * rendu relancerait inutilement la configuration d'Axios.
 *
 * Chaque instance porte deux intercepteurs, posés ici plutôt que dans les
 * fonctions de `src/api` pour qu'aucun appel ne puisse les oublier :
 *   - en requête, le jeton de session est ajouté en `Authorization` ;
 *   - en réponse, un 401 ferme la session, ce qui ramène l'utilisateur au
 *     formulaire de connexion sans qu'aucun écran ait à le décider.
 */

import type { AxiosInstance } from "axios";
import { closeSession, getToken } from "../auth/session";
import { getApiBaseUrl, getPredictBaseUrl } from "../config/env";
import { createHttpClient } from "./http";

const clientsByBaseUrl = new Map<string, AxiosInstance>();

/**
 * Pose les intercepteurs d'authentification sur une instance.
 *
 * Le jeton est relu à chaque requête, jamais capturé à la création du client :
 * une instance mémorisée doit continuer de signer correctement après une
 * reconnexion.
 */
export function attachAuth(client: AxiosInstance): AxiosInstance {
  client.interceptors.request.use((config) => {
    const token = getToken();
    if (token !== null) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      // Le 401 du formulaire de connexion lui-même passe aussi par ici :
      // fermer une session inexistante est sans effet, et l'écran de login
      // affiche le message d'identifiants invalides comme d'habitude.
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === 401) {
        closeSession();
      }
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    },
  );

  return client;
}

function clientFor(baseUrl: string): AxiosInstance {
  const existing = clientsByBaseUrl.get(baseUrl);
  if (existing !== undefined) {
    return existing;
  }
  const created = attachAuth(createHttpClient(baseUrl));
  clientsByBaseUrl.set(baseUrl, created);
  return created;
}

/** Client de l'API métier (sites, mesures et authentification). */
export function getApiClient(): AxiosInstance {
  return clientFor(getApiBaseUrl());
}

/** Client du service d'inférence. */
export function getPredictClient(): AxiosInstance {
  return clientFor(getPredictBaseUrl());
}
