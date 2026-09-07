/**
 * Registre des modèles : la version promue, et celles qui l'ont précédée.
 *
 * Deux lectures menées ensemble, aux échecs indépendants — mais avec une
 * asymétrie qui compte : `GET /models/current` répond **404 quand aucun modèle
 * n'est promu**, ce qui est le cas courant tant que rien n'a été publié au
 * registre MLflow. Ce 404 n'est donc pas une panne, et il est traduit en
 * « aucun modèle promu » plutôt qu'en erreur rouge. Les autres codes, eux,
 * restent des erreurs.
 *
 * Le registre ne dépend d'aucun site : le hook ne prend pas de `siteId` et ne
 * recharge pas au changement de site.
 */

import { useEffect, useState } from "react";
import type { Model } from "../api/models";
import { ApiError } from "../api/http";
import { fetchCurrentModel, fetchModels } from "../api/models";
import { getApiClient } from "../api/clients";
import { isCancellation } from "../api/http";

/** État exposé par `useModelRegistry`. */
export interface ModelRegistryState {
  /** Modèle actuellement promu, `null` si aucun ne l'est. */
  current: Model | null;
  /** Registre complet, le plus récent d'abord. */
  models: Model[];
  /** Vrai tant que la première réponse n'est pas arrivée. */
  isLoading: boolean;
  /** Erreur de la lecture du registre, `null` si elle a abouti. */
  error: string | null;
  /** Erreur de la lecture du modèle promu. Un 404 n'en est pas une. */
  currentError: string | null;
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function useModelRegistry(): ModelRegistryState {
  const [state, setState] = useState<Omit<ModelRegistryState, "isLoading">>({
    current: null,
    models: [],
    error: null,
    currentError: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load(): Promise<void> {
      const client = getApiClient();
      const [models, current] = await Promise.allSettled([
        fetchModels(client, controller.signal),
        fetchCurrentModel(client, controller.signal),
      ]);

      if (!active) {
        return;
      }
      if (
        (models.status === "rejected" && isCancellation(models.reason)) ||
        (current.status === "rejected" && isCancellation(current.reason))
      ) {
        return;
      }

      // Le 404 de `/models/current` dit « aucun modèle promu », pas « erreur ».
      const currentMissing =
        current.status === "rejected" &&
        current.reason instanceof ApiError &&
        current.reason.status === 404;

      setState({
        models: models.status === "fulfilled" ? models.value : [],
        current: current.status === "fulfilled" ? current.value : null,
        error: models.status === "rejected" ? messageOf(models.reason) : null,
        currentError:
          current.status === "rejected" && !currentMissing
            ? messageOf(current.reason)
            : null,
      });
      setIsLoading(false);
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return { ...state, isLoading };
}
