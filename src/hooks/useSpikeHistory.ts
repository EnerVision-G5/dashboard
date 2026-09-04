/**
 * Historique des pics de consommation simulés sur un site.
 *
 * Cet historique ne se rafraîchit pas tout seul, et c'est voulu : un pic
 * n'apparaît que si quelqu'un le déclenche. Le hook expose donc `reload`, que
 * le bouton de déclenchement appelle une fois l'ordre accepté — l'écran se met
 * à jour à cause d'une action, pas d'un minuteur.
 *
 * Mêmes garde-fous que les autres flux : l'état porte son `siteId`, la requête
 * est annulée au changement de site, et rien n'est exposé sous le nom d'un
 * autre site.
 */

import { useCallback, useEffect, useState } from "react";
import type { SpikeSimulation } from "../api/simulations";
import { fetchSpikes } from "../api/simulations";
import { getApiClient } from "../api/clients";
import { isCancellation } from "../api/http";

/** État exposé par `useSpikeHistory`. */
export interface SpikeHistoryState {
  spikes: SpikeSimulation[];
  isLoading: boolean;
  error: string | null;
  /** Relit l'historique, après un déclenchement par exemple. */
  reload: () => void;
}

interface LoadedState {
  siteId: string | null;
  spikes: SpikeSimulation[];
  error: string | null;
}

const EMPTY: LoadedState = { siteId: null, spikes: [], error: null };

export function useSpikeHistory(siteId: string | null): SpikeHistoryState {
  const [loaded, setLoaded] = useState<LoadedState>(EMPTY);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    if (siteId === null) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function load(currentSiteId: string): Promise<void> {
      try {
        const spikes = await fetchSpikes({
          client: getApiClient(),
          siteId: currentSiteId,
          signal: controller.signal,
        });
        if (active) {
          setLoaded({ siteId: currentSiteId, spikes, error: null });
        }
      } catch (caught) {
        if (!active || isCancellation(caught)) {
          return;
        }
        setLoaded({
          siteId: currentSiteId,
          spikes: [],
          error: caught instanceof Error ? caught.message : String(caught),
        });
      }
    }

    void load(siteId);

    return () => {
      active = false;
      controller.abort();
    };
  }, [siteId, refreshCount]);

  const reload = useCallback(() => {
    setRefreshCount((count) => count + 1);
  }, []);

  const isCurrent = siteId !== null && loaded.siteId === siteId;

  return {
    spikes: isCurrent ? loaded.spikes : [],
    error: isCurrent ? loaded.error : null,
    isLoading: siteId !== null && !isCurrent,
    reload,
  };
}
