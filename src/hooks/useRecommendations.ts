/**
 * Recommandations du site affiché (EV-54).
 *
 * Mêmes garde-fous que les autres flux du dashboard : l'état porte
 * l'identifiant du site auquel il appartient et n'est exposé que si cet
 * identifiant est encore celui demandé, la requête en cours est annulée au
 * changement de site, et une erreur n'est jamais remplacée par une liste vide
 * — un conseil absent parce que l'API est tombée n'est pas la même chose qu'un
 * site sans conseil à donner.
 *
 * Le rafraîchissement est bien plus lent que celui des mesures : les
 * recommandations découlent des prévisions, qu'un job recalcule **toutes les
 * heures**. Interroger l'API toutes les trente secondes relirait le même
 * raisonnement sur les mêmes prévisions ; cinq minutes suffisent à ce qu'un
 * nouveau calcul apparaisse à l'écran sans avoir à recharger la page.
 */

import { useEffect, useState } from "react";
import type { Recommendations } from "../api/recommendations";
import { fetchRecommendations } from "../api/recommendations";
import { getApiClient } from "../api/clients";
import { isCancellation } from "../api/http";

/** Période de rafraîchissement des recommandations. */
export const RECOMMENDATIONS_REFRESH_INTERVAL_MS = 300_000;

/** État exposé par `useRecommendations`. */
export interface RecommendationsState {
  /** Jeu de recommandations du site demandé, `null` tant que rien n'est arrivé. */
  recommendations: Recommendations | null;
  /** Vrai tant que la première réponse du site demandé n'est pas arrivée. */
  isLoading: boolean;
  /** Erreur du flux, `null` s'il a abouti. */
  error: string | null;
}

interface LoadedState {
  siteId: string | null;
  recommendations: Recommendations | null;
  error: string | null;
}

const EMPTY: LoadedState = { siteId: null, recommendations: null, error: null };

export function useRecommendations(siteId: string | null): RecommendationsState {
  const [loaded, setLoaded] = useState<LoadedState>(EMPTY);

  useEffect(() => {
    if (siteId === null) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function load(currentSiteId: string): Promise<void> {
      try {
        const recommendations = await fetchRecommendations({
          client: getApiClient(),
          siteId: currentSiteId,
          signal: controller.signal,
        });
        if (active) {
          setLoaded({ siteId: currentSiteId, recommendations, error: null });
        }
      } catch (caught) {
        if (!active || isCancellation(caught)) {
          return;
        }
        // Les conseils précédents sont effacés avec l'erreur : garder à
        // l'écran une action à mener sans savoir si elle est encore d'actualité
        // serait pire que de dire qu'on ne sait pas.
        setLoaded({
          siteId: currentSiteId,
          recommendations: null,
          error: caught instanceof Error ? caught.message : String(caught),
        });
      }
    }

    void load(siteId);
    const timer = setInterval(() => {
      void load(siteId);
    }, RECOMMENDATIONS_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
      controller.abort();
    };
  }, [siteId]);

  const isCurrent = siteId !== null && loaded.siteId === siteId;

  return {
    recommendations: isCurrent ? loaded.recommendations : null,
    error: isCurrent ? loaded.error : null,
    isLoading: siteId !== null && !isCurrent,
  };
}
