/**
 * Fraîcheur et qualité des données, pour le bandeau d'EV-18.
 *
 * Deux flux, une seule synthèse :
 *   - `GET /indicators` couvre les sept sites en une requête, et sert la
 *     fraîcheur d'ingestion et la part de mesures dégradées ;
 *   - `GET /sites/{id}/sensors` ne concerne que le site affiché, le contrat ne
 *     publiant pas d'équivalent pour le parc.
 *
 * Les deux échouent indépendamment, comme partout ailleurs dans le dashboard :
 * des capteurs indisponibles n'effacent pas une fraîcheur correctement lue, et
 * réciproquement. Un bandeau qui disparaîtrait à la première erreur serait
 * exactement le contraire de ce que ce ticket cherche à obtenir.
 *
 * L'effet ne fait que des entrées-sorties, et la synthèse est calculée au
 * rendu. Cette séparation n'est pas cosmétique : les noms de sites arrivent
 * de `useSites`, donc après le premier chargement des indicateurs. Si la
 * synthèse était faite dans l'effet, les messages garderaient les
 * identifiants techniques — « SITE-002 n'a aucune mesure » — jusqu'au
 * rafraîchissement suivant, une minute plus tard.
 *
 * Ce rafraîchissement n'est pas un ornement non plus : la fraîcheur se dégrade
 * toute seule avec le temps. Un bandeau figé finirait par affirmer que les
 * données sont à jour alors que l'ingestion est tombée dix minutes plus tôt.
 */

import { useEffect, useMemo, useState } from "react";
import type { SiteIndicators } from "../api/indicators";
import type { SensorHealth } from "../api/sensors";
import type { DataHealth } from "../lib/dataHealth";
import { fetchIndicators } from "../api/indicators";
import { fetchSensors } from "../api/sensors";
import { getApiClient } from "../api/clients";
import { isCancellation } from "../api/http";
import { buildDataHealth } from "../lib/dataHealth";

/**
 * Période de rafraîchissement du bandeau.
 *
 * Une minute : c'est le pas d'écriture de la collecte, et les indicateurs sont
 * calculés sur une fenêtre de 24 heures qui ne bouge pas plus vite que cela.
 */
export const HEALTH_REFRESH_INTERVAL_MS = 60_000;

/** État exposé par `useDataHealth`. */
export interface DataHealthState {
  /** Synthèse affichable, `null` tant que rien n'est arrivé. */
  health: DataHealth | null;
  /** Vrai tant que la première réponse n'est pas arrivée. */
  isLoading: boolean;
  /** Erreur du flux des indicateurs, `null` s'il a abouti. */
  indicatorsError: string | null;
  /** Erreur du flux des capteurs, `null` s'il a abouti. */
  sensorsError: string | null;
}

interface LoadedState {
  /** Site auquel appartiennent les capteurs ci-dessous. */
  siteId: string | null;
  indicators: SiteIndicators[];
  sensors: SensorHealth[];
  indicatorsError: string | null;
  sensorsError: string | null;
}

const EMPTY: LoadedState = {
  siteId: null,
  indicators: [],
  sensors: [],
  indicatorsError: null,
  sensorsError: null,
};

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/**
 * Charge les indicateurs du parc et les capteurs du site affiché.
 *
 * `labelOf` traduit un identifiant de site en nom lisible. Il est passé en
 * paramètre plutôt que lu ici : le référentiel des sites est déjà chargé par
 * `useSites`, le relire serait une requête de plus pour une information déjà
 * à l'écran.
 */
export function useDataHealth(
  siteId: string | null,
  labelOf?: (siteId: string) => string,
): DataHealthState {
  const [loaded, setLoaded] = useState<LoadedState>(EMPTY);

  useEffect(() => {
    if (siteId === null) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function load(currentSiteId: string): Promise<void> {
      const client = getApiClient();
      const [indicators, sensors] = await Promise.allSettled([
        fetchIndicators({ client, signal: controller.signal }),
        fetchSensors(client, currentSiteId, controller.signal),
      ]);

      if (!active) {
        return;
      }
      if (
        (indicators.status === "rejected" && isCancellation(indicators.reason)) ||
        (sensors.status === "rejected" && isCancellation(sensors.reason))
      ) {
        return;
      }

      setLoaded({
        siteId: currentSiteId,
        indicators: indicators.status === "fulfilled" ? indicators.value : [],
        sensors: sensors.status === "fulfilled" ? sensors.value : [],
        indicatorsError:
          indicators.status === "rejected" ? messageOf(indicators.reason) : null,
        sensorsError: sensors.status === "rejected" ? messageOf(sensors.reason) : null,
      });
    }

    void load(siteId);
    const timer = setInterval(() => {
      void load(siteId);
    }, HEALTH_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
      controller.abort();
    };
  }, [siteId]);

  // Les capteurs affichés doivent appartenir au site demandé : pendant un
  // changement de site, l'état précédent n'est pas exposé.
  const isCurrent = siteId !== null && loaded.siteId === siteId;

  const health = useMemo(
    () =>
      isCurrent
        ? buildDataHealth({
            indicators: loaded.indicators,
            sensors: loaded.sensors,
            labelOf,
          })
        : null,
    [isCurrent, loaded.indicators, loaded.sensors, labelOf],
  );

  return {
    health,
    indicatorsError: isCurrent ? loaded.indicatorsError : null,
    sensorsError: isCurrent ? loaded.sensorsError : null,
    isLoading: siteId !== null && !isCurrent,
  };
}
